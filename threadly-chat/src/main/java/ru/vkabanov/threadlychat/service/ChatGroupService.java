package ru.vkabanov.threadlychat.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import ru.vkabanov.threadlychat.exception.BadRequestException;
import ru.vkabanov.threadlychat.exception.ForbiddenException;
import ru.vkabanov.threadlychat.exception.ResourceNotFoundException;
import ru.vkabanov.threadlychat.model.*;
import ru.vkabanov.threadlychat.repository.ChatGroupRepository;
import ru.vkabanov.threadlychat.repository.ChatMessageRepository;

import java.io.InputStream;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatGroupService {

    private final ChatGroupRepository groupRepository;
    private final ChatMessageRepository messageRepository;
    private final MongoOperations mongoOperations;
    private final SimpMessagingTemplate messagingTemplate;
    private final PushNotificationService pushNotificationService;
    private final UserStatusService userStatusService;
    private final ImageStorageService imageStorageService;

    /**
     * Создать группу.
     */
    public ChatGroup createGroup(String creatorId, String name, Set<String> memberIds) {
        if (name == null || name.trim().isEmpty()) {
            throw new BadRequestException("Название группы не может быть пустым");
        }
        if (memberIds == null) {
            memberIds = new HashSet<>();
        }
        memberIds.add(creatorId); // создатель всегда участник

        ChatGroup group = ChatGroup.builder()
                .name(name.trim())
                .creatorId(creatorId)
                .memberIds(memberIds)
                .createdAt(new Date())
                .build();
        ChatGroup saved = groupRepository.save(group);

        // Уведомляем всех участников о создании группы
        for (String memberId : saved.getMemberIds()) {
            messagingTemplate.convertAndSendToUser(memberId, "/queue/group-update", saved);
        }

        // Системное сообщение о создании группы
        sendSystemMessage(saved.getId(), creatorId, "created", saved.getMemberIds());

        return saved;
    }

    /**
     * Список групп пользователя.
     */
    public List<ChatGroup> getUserGroups(String userId) {
        List<ChatGroup> groups = groupRepository.findByMemberIdsContaining(userId);
        for (ChatGroup group : groups) {
            Query q = new Query(Criteria.where("chatId").is("group_" + group.getId()));
            q.with(Sort.by(Sort.Direction.DESC, "timestamp"));
            q.limit(1);
            List<ChatMessage> lastMsgs = mongoOperations.find(q, ChatMessage.class);
            if (!lastMsgs.isEmpty()) {
                group.setLastMessage(lastMsgs.get(0));
            }
        }
        return groups;
    }

    /**
     * Найти группу по ID. Проверяет что пользователь — участник.
     */
    public ChatGroup getGroup(String groupId, String userId) {
        ChatGroup group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Группа не найдена: " + groupId));
        if (!group.getMemberIds().contains(userId)) {
            throw new ForbiddenException("Вы не участник этой группы");
        }
        return group;
    }

    /**
     * Переименовать группу (только создатель).
     */
    public ChatGroup renameGroup(String groupId, String userId, String newName) {
        ChatGroup group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Группа не найдена"));
        if (!group.getCreatorId().equals(userId)) {
            throw new ForbiddenException("Только создатель может переименовать группу");
        }
        if (newName == null || newName.trim().isEmpty()) {
            throw new BadRequestException("Название не может быть пустым");
        }
        group.setName(newName.trim());
        ChatGroup saved = groupRepository.save(group);
        enrichWithAvatarUrl(saved);

        for (String memberId : saved.getMemberIds()) {
            messagingTemplate.convertAndSendToUser(memberId, "/queue/group-update", saved);
        }
        return saved;
    }

    /**
     * Добавить участников (только создатель).
     */
    public ChatGroup addMembers(String groupId, String userId, Set<String> newMemberIds) {
        ChatGroup group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Группа не найдена"));
        if (!group.getCreatorId().equals(userId)) {
            throw new ForbiddenException("Только создатель может добавлять участников");
        }
        Set<String> actuallyNew = new HashSet<>(newMemberIds);
        actuallyNew.removeAll(group.getMemberIds());
        group.getMemberIds().addAll(newMemberIds);
        ChatGroup saved = groupRepository.save(group);
        enrichWithAvatarUrl(saved);

        for (String memberId : saved.getMemberIds()) {
            messagingTemplate.convertAndSendToUser(memberId, "/queue/group-update", saved);
        }
        // Системное сообщение для каждого нового участника
        for (String newId : actuallyNew) {
            sendSystemMessage(groupId, newId, "joined", saved.getMemberIds());
        }
        return saved;
    }

    /**
     * Удалить участника (создатель удаляет, или участник выходит сам).
     */
    public ChatGroup removeMember(String groupId, String requesterId, String targetUserId) {
        ChatGroup group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Группа не найдена"));

        boolean isSelfLeave = requesterId.equals(targetUserId);
        boolean isCreator = group.getCreatorId().equals(requesterId);

        if (!isSelfLeave && !isCreator) {
            throw new ForbiddenException("Только создатель может удалять участников");
        }

        // Создатель не может покинуть группу (только удалить)
        if (isSelfLeave && isCreator) {
            throw new BadRequestException("Создатель не может покинуть группу. Удалите группу.");
        }

        group.getMemberIds().remove(targetUserId);
        ChatGroup saved = groupRepository.save(group);
        enrichWithAvatarUrl(saved);

        // Системное сообщение
        Set<String> allRecipients = new HashSet<>(saved.getMemberIds());
        allRecipients.add(targetUserId);
        sendSystemMessage(groupId, targetUserId, isSelfLeave ? "left" : "removed", allRecipients);

        // Уведомляем удалённого участника
        messagingTemplate.convertAndSendToUser(targetUserId, "/queue/group-update", saved);
        // Уведомляем оставшихся
        for (String memberId : saved.getMemberIds()) {
            messagingTemplate.convertAndSendToUser(memberId, "/queue/group-update", saved);
        }
        return saved;
    }

    /**
     * Удалить группу (только создатель).
     */
    public void deleteGroup(String groupId, String userId) {
        ChatGroup group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Группа не найдена"));
        if (!group.getCreatorId().equals(userId)) {
            throw new ForbiddenException("Только создатель может удалить группу");
        }

        // Удаляем все сообщения группы
        Query query = new Query(Criteria.where("chatId").is("group_" + groupId));
        mongoOperations.remove(query, ChatMessage.class);

        // Уведомляем участников
        Map<String, Object> deleteNotification = Map.of("deleted", true, "id", groupId);
        for (String memberId : group.getMemberIds()) {
            messagingTemplate.convertAndSendToUser(memberId, "/queue/group-update", deleteNotification);
        }

        groupRepository.deleteById(groupId);
    }

    /**
     * Отправить сообщение в группу.
     */
    public ChatMessage sendGroupMessage(ChatMessage chatMessage, String groupId) {
        ChatGroup group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Группа не найдена"));

        if (!group.getMemberIds().contains(chatMessage.getSenderId())
                && chatMessage.getMessageType() != MessageType.SYSTEM) {
            throw new ForbiddenException("Вы не участник этой группы");
        }

        chatMessage.setChatId("group_" + groupId);
        chatMessage.setStatus(MessageStatus.RECEIVED);

        // Для обычных сообщений ставим readBy с отправителем
        if (chatMessage.getMessageType() != MessageType.SYSTEM) {
            Set<String> initialReadBy = new HashSet<>();
            initialReadBy.add(chatMessage.getSenderId());
            chatMessage.setReadBy(initialReadBy);
        }

        ChatMessage saved = messageRepository.save(chatMessage);

        // Отправляем полное сообщение всем участникам (кроме отправителя) в /queue/group-messages
        for (String memberId : group.getMemberIds()) {
            if (!memberId.equals(chatMessage.getSenderId())) {
                messagingTemplate.convertAndSendToUser(memberId, "/queue/group-messages", saved);

                // Push-уведомление (если не заглушено и не системное)
                if (chatMessage.getMessageType() != MessageType.SYSTEM) {
                    boolean isMuted = group.getMutedBy() != null && group.getMutedBy().contains(memberId);
                    if (!isMuted && !"online".equalsIgnoreCase(userStatusService.getStatus(memberId))) {
                        pushNotificationService.sendToUser(memberId, Map.of(
                                "type", "chat_message",
                                "messageId", saved.getId(),
                                "senderId", saved.getSenderId(),
                                "senderName", saved.getSenderName() != null ? saved.getSenderName() : "",
                                "recipientId", memberId,
                                "content", saved.getContent() != null ? saved.getContent() : "",
                                "groupId", groupId,
                                "groupName", group.getName()
                        ));
                    }
                }
            }
        }

        // Sent ack to sender
        if (chatMessage.getMessageType() != MessageType.SYSTEM) {
            messagingTemplate.convertAndSendToUser(chatMessage.getSenderId(), "/queue/sent-ack", saved);
        }

        return saved;
    }

    /**
     * Получить сообщения группы с пагинацией.
     */
    public ChatMessagesPage getGroupMessages(String groupId, String userId, int page, int size) {
        ChatGroup group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Группа не найдена"));
        if (!group.getMemberIds().contains(userId)) {
            throw new ForbiddenException("Вы не участник этой группы");
        }

        if (page < 0) page = 0;
        if (size <= 0 || size > 200) size = 50;

        String chatId = "group_" + groupId;
        Query query = new Query(Criteria.where("chatId").is(chatId));
        query.with(Sort.by(Sort.Direction.DESC, "timestamp"));
        query.skip((long) page * size);
        query.limit(size + 1);

        List<ChatMessage> results = mongoOperations.find(query, ChatMessage.class);
        boolean hasMore = results.size() > size;
        if (hasMore) {
            results = results.subList(0, size);
        }

        return ChatMessagesPage.builder()
                .items(results)
                .hasMore(hasMore)
                .nextPage(hasMore ? page + 1 : null)
                .build();
    }

    /**
     * Загрузить аватарку группы (только создатель).
     */
    public ChatGroup uploadAvatar(String groupId, String userId, MultipartFile file) {
        ChatGroup group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Группа не найдена"));
        if (!group.getCreatorId().equals(userId)) {
            throw new ForbiddenException("Только создатель может изменить аватарку группы");
        }
        if (!imageStorageService.isEnabled()) {
            throw new BadRequestException("Хранилище файлов недоступно");
        }
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Файл не предоставлен");
        }
        if (file.getSize() > 10L * 1024 * 1024) {
            throw new BadRequestException("Размер файла не более 10 МБ");
        }
        String contentType = file.getContentType();
        if (contentType == null || !List.of("image/jpeg", "image/png", "image/webp").contains(contentType)) {
            throw new BadRequestException("Допустимы только JPG, PNG и WebP");
        }

        // Delete old avatar if exists
        if (group.getAvatarKey() != null && !group.getAvatarKey().isBlank()) {
            try {
                imageStorageService.delete(group.getAvatarKey());
            } catch (Exception e) {
                log.warn("Failed to delete old group avatar: {}", e.getMessage());
            }
        }

        String extension = contentType.equals("image/png") ? "png" : contentType.equals("image/webp") ? "webp" : "jpg";
        String objectKey = "groups/" + groupId + "/avatar." + extension;

        try (InputStream is = file.getInputStream()) {
            imageStorageService.upload(is, file.getSize(), contentType, objectKey);
        } catch (Exception e) {
            log.error("Group avatar upload failed for group {}: {}", groupId, e.getMessage());
            throw new BadRequestException("Не удалось загрузить аватарку");
        }

        group.setAvatarKey(objectKey);
        ChatGroup saved = groupRepository.save(group);

        // Enrich with presigned URL
        imageStorageService.getPresignedUrl(objectKey).ifPresent(saved::setAvatarUrl);

        // Notify all members
        for (String memberId : saved.getMemberIds()) {
            messagingTemplate.convertAndSendToUser(memberId, "/queue/group-update", saved);
        }

        return saved;
    }

    /**
     * Получить presigned URL аватарки группы.
     */
    public Optional<String> getAvatarUrl(String groupId, String userId) {
        ChatGroup group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Группа не найдена"));
        if (!group.getMemberIds().contains(userId)) {
            throw new ForbiddenException("Вы не участник этой группы");
        }
        if (group.getAvatarKey() == null || group.getAvatarKey().isBlank()) {
            return Optional.empty();
        }
        return imageStorageService.getPresignedUrl(group.getAvatarKey());
    }

    /**
     * Обогатить группу presigned URL аватарки (для отдачи клиенту).
     */
    public void enrichWithAvatarUrl(ChatGroup group) {
        if (group != null && group.getAvatarKey() != null && !group.getAvatarKey().isBlank()) {
            imageStorageService.getPresignedUrl(group.getAvatarKey()).ifPresent(group::setAvatarUrl);
        }
    }

    /**
     * Отметить сообщения группы как прочитанные пользователем.
     */
    public long markGroupMessagesRead(String groupId, String userId) {
        ChatGroup group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Группа не найдена"));
        if (!group.getMemberIds().contains(userId)) {
            throw new ForbiddenException("Вы не участник этой группы");
        }
        Query query = new Query(Criteria
                .where("chatId").is("group_" + groupId)
                .and("senderId").ne(userId)
                .and("readBy").nin(userId));
        Update update = new Update().addToSet("readBy", userId);
        return mongoOperations.updateMulti(query, update, ChatMessage.class).getModifiedCount();
    }

    /**
     * Переключить уведомления группы для пользователя (mute/unmute).
     */
    public ChatGroup toggleMute(String groupId, String userId) {
        ChatGroup group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Группа не найдена"));
        if (!group.getMemberIds().contains(userId)) {
            throw new ForbiddenException("Вы не участник этой группы");
        }
        if (group.getMutedBy() == null) {
            group.setMutedBy(new HashSet<>());
        }
        if (group.getMutedBy().contains(userId)) {
            group.getMutedBy().remove(userId);
        } else {
            group.getMutedBy().add(userId);
        }
        ChatGroup saved = groupRepository.save(group);
        enrichWithAvatarUrl(saved);
        return saved;
    }

    /**
     * Отправить системное сообщение в группу (вступление, выход и т.д.).
     */
    private void sendSystemMessage(String groupId, String userId, String content, Set<String> recipientIds) {
        ChatMessage systemMsg = ChatMessage.builder()
                .chatId("group_" + groupId)
                .senderId(userId)
                .messageType(MessageType.SYSTEM)
                .content(content)
                .timestamp(new Date())
                .status(MessageStatus.RECEIVED)
                .build();
        ChatMessage saved = messageRepository.save(systemMsg);
        for (String memberId : recipientIds) {
            messagingTemplate.convertAndSendToUser(memberId, "/queue/group-messages", saved);
        }
    }
}
