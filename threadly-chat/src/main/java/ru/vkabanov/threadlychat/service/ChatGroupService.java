package ru.vkabanov.threadlychat.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import ru.vkabanov.threadlychat.exception.BadRequestException;
import ru.vkabanov.threadlychat.exception.ForbiddenException;
import ru.vkabanov.threadlychat.exception.ResourceNotFoundException;
import ru.vkabanov.threadlychat.model.*;
import ru.vkabanov.threadlychat.repository.ChatGroupRepository;
import ru.vkabanov.threadlychat.repository.ChatMessageRepository;

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

        return saved;
    }

    /**
     * Список групп пользователя.
     */
    public List<ChatGroup> getUserGroups(String userId) {
        return groupRepository.findByMemberIdsContaining(userId);
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
        group.getMemberIds().addAll(newMemberIds);
        ChatGroup saved = groupRepository.save(group);

        for (String memberId : saved.getMemberIds()) {
            messagingTemplate.convertAndSendToUser(memberId, "/queue/group-update", saved);
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

        if (!group.getMemberIds().contains(chatMessage.getSenderId())) {
            throw new ForbiddenException("Вы не участник этой группы");
        }

        chatMessage.setChatId("group_" + groupId);
        chatMessage.setStatus(MessageStatus.RECEIVED);
        ChatMessage saved = messageRepository.save(chatMessage);

        // Уведомляем всех участников кроме отправителя
        for (String memberId : group.getMemberIds()) {
            if (!memberId.equals(chatMessage.getSenderId())) {
                messagingTemplate.convertAndSendToUser(memberId, "/queue/messages",
                        new ChatNotification(saved.getId(), saved.getSenderId(), saved.getSenderName()));

                if (!"online".equalsIgnoreCase(userStatusService.getStatus(memberId))) {
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

        // Sent ack to sender
        messagingTemplate.convertAndSendToUser(chatMessage.getSenderId(), "/queue/sent-ack", saved);

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
}
