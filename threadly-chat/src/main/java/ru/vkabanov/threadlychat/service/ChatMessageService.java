package ru.vkabanov.threadlychat.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import ru.vkabanov.threadlychat.exception.ResourceNotFoundException;
import ru.vkabanov.threadlychat.exception.ForbiddenException;
import ru.vkabanov.threadlychat.model.ChatMessage;
import ru.vkabanov.threadlychat.model.ChatImagesPage;
import ru.vkabanov.threadlychat.model.ChatMessagesPage;
import ru.vkabanov.threadlychat.model.ChatRoom;
import ru.vkabanov.threadlychat.model.ChatNotification;
import ru.vkabanov.threadlychat.model.MessageStatus;
import ru.vkabanov.threadlychat.model.MessageType;
import ru.vkabanov.threadlychat.model.ReadReceiptPayload;
import ru.vkabanov.threadlychat.repository.ChatMessageRepository;
import ru.vkabanov.threadlychat.repository.ChatRoomRepository;

import org.springframework.data.domain.Sort;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class ChatMessageService {

    @Autowired
    private ChatMessageRepository repository;
    @Autowired
    private ChatRoomService chatRoomService;
    @Autowired
    private MongoOperations mongoOperations;
    @Autowired
    private SimpMessagingTemplate messagingTemplate;
    @Autowired
    private UserStatusService userStatusService;
    @Autowired
    private PushNotificationService pushNotificationService;
    @Autowired(required = false)
    private ImageStorageService imageStorageService;
    @Autowired
    private ChatRoomRepository chatRoomRepository;

    /** Сохраняет сообщение, уведомляет получателя и при необходимости отправляет push. Возвращает сохранённое сообщение для sent-ack. */
    public ChatMessage sendMessage(ChatMessage chatMessage) {
        var chatId = chatRoomService.getChatId(chatMessage.getSenderId(), chatMessage.getRecipientId(), true);
        chatMessage.setChatId(chatId.get());
        ChatMessage saved = save(chatMessage);
        messagingTemplate.convertAndSendToUser(chatMessage.getRecipientId(), "/queue/messages",
                new ChatNotification(saved.getId(), saved.getSenderId(), saved.getSenderName()));

        if (!"online".equalsIgnoreCase(userStatusService.getStatus(chatMessage.getRecipientId()))) {
            String content = saved.getContent();
            if (saved.getMessageType() == MessageType.IMAGE) {
                content = content != null ? content : "[Photo]";
            } else if (saved.getMessageType() == MessageType.VIDEO_CIRCLE) {
                content = "🔵 Видеосообщение";
            } else if (saved.getMessageType() == MessageType.VOICE) {
                content = "🎤 Голосовое сообщение";
            }
            pushNotificationService.sendToUser(chatMessage.getRecipientId(), Map.of(
                    "type", "chat_message",
                    "messageId", saved.getId(),
                    "senderId", saved.getSenderId(),
                    "senderName", saved.getSenderName() != null ? saved.getSenderName() : "",
                    "recipientId", saved.getRecipientId(),
                    "content", content
            ));
        }

        return saved;
    }

    public ChatMessage save(ChatMessage chatMessage) {
        chatMessage.setStatus(MessageStatus.RECEIVED);
        repository.save(chatMessage);
        return chatMessage;
    }

    public long countNewMessages(String senderId, String recipientId) {
        Query query = new Query(Criteria
                .where("senderId").is(senderId)
                .and("recipientId").is(recipientId)
                .and("status").is(MessageStatus.RECEIVED)
                .and("deletedFor").ne(recipientId));
        return mongoOperations.count(query, ChatMessage.class);
    }

    /**
     * Пагинированная загрузка сообщений чата (как для вкладки «Фото»).
     * Сортировка по дате DESC: страница 0 — самые новые, при подгрузке — более старые.
     *
     * @param senderId   один участник (например, контакт)
     * @param recipientId второй участник (например, текущий пользователь)
     * @param page       номер страницы (0-based)
     * @param size       размер страницы
     */
    public ChatMessagesPage findChatMessagesPage(String senderId, String recipientId, int page, int size) {
        if (page < 0) page = 0;
        if (size <= 0 || size > 200) size = 50;

        var chatIdOpt = chatRoomService.getChatId(senderId, recipientId, false);
        if (chatIdOpt.isEmpty()) {
            return ChatMessagesPage.builder()
                    .items(new ArrayList<>())
                    .hasMore(false)
                    .nextPage(null)
                    .build();
        }
        String chatId = chatIdOpt.get();

        Query query = new Query(Criteria
                .where("chatId").is(chatId)
                .and("deletedFor").ne(recipientId));
        query.with(Sort.by(Sort.Direction.DESC, "timestamp"));
        query.skip((long) page * size);
        query.limit(size + 1);

        List<ChatMessage> results = mongoOperations.find(query, ChatMessage.class);
        boolean hasMore = results.size() > size;
        if (hasMore) {
            results = results.subList(0, size);
        }

        if (page == 0 && !results.isEmpty()) {
            long modified = updateStatuses(senderId, recipientId, MessageStatus.DELIVERED);

            if (modified > 0) {
                messagingTemplate.convertAndSendToUser(senderId, "/queue/read-receipts", new ReadReceiptPayload(recipientId));
            }
        }

        enrichWithImageUrls(results);

        return ChatMessagesPage.builder()
                .items(results)
                .hasMore(hasMore)
                .nextPage(hasMore ? page + 1 : null)
                .build();
    }

    public ChatMessage findById(String id) {
        ChatMessage message = repository.findById(id)
                .map(chatMessage -> {
                    chatMessage.setStatus(MessageStatus.DELIVERED);
                    return repository.save(chatMessage);
                })
                .orElseThrow(() -> new ResourceNotFoundException("can't find message (" + id + ")"));
        enrichWithImageUrl(message);
        enrichWithMediaUrl(message);
        return message;
    }

    public List<String> findContactIds(String userId) {
        Query query = new Query(new Criteria().orOperator(
                Criteria.where("senderId").is(userId),
                Criteria.where("recipientId").is(userId)
        ));
        query.addCriteria(Criteria.where("deletedFor").ne(userId));

        Set<String> contacts = new HashSet<>();
        contacts.addAll(mongoOperations.findDistinct(query, "senderId", ChatMessage.class, String.class));
        contacts.addAll(mongoOperations.findDistinct(query, "recipientId", ChatMessage.class, String.class));
        contacts.remove(userId);

        return new ArrayList<>(contacts);
    }

    /**
     * Количество непрочитанных сообщений по каждому контакту (от контакта текущему пользователю).
     * Один запрос агрегации — без N+1 и без загрузки всех документов в память.
     */
    public Map<String, Long> getUnreadCountsByContact(String recipientId) {
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(Criteria
                        .where("recipientId").is(recipientId)
                        .and("status").is(MessageStatus.RECEIVED)
                        .and("deletedFor").ne(recipientId)),
                Aggregation.group("senderId").count().as("count"),
                Aggregation.project("count").and("_id").as("senderId")
        );

        AggregationResults<Map> results = mongoOperations.aggregate(aggregation, ChatMessage.class, Map.class);
        Map<String, Long> counts = new HashMap<>();

        for (Map doc : results.getMappedResults()) {
            String senderId = (String) doc.get("senderId");
            Number count = (Number) doc.get("count");
            if (senderId != null && count != null) {
                counts.put(senderId, count.longValue());
            }
        }

        return counts;
    }

    /**
     * Обновляет статус сообщений (например, на DELIVERED при прочтении).
     * Обновляются только сообщения со статусом RECEIVED, чтобы избежать лишних записей и дублирования read-receipt.
     *
     * @return количество обновлённых документов
     */
    public long updateStatuses(String senderId, String recipientId, MessageStatus status) {
        Query query = new Query(Criteria
                .where("senderId").is(senderId)
                .and("recipientId").is(recipientId)
                .and("status").is(MessageStatus.RECEIVED)
                .and("deletedFor").ne(recipientId));
        Update update = Update.update("status", status);
        return mongoOperations.updateMulti(query, update, ChatMessage.class).getModifiedCount();
    }

    public void deleteChatForUser(String senderId, String recipientId, String userId) {
        var chatId = chatRoomService.getChatId(senderId, recipientId, false).orElse(null);
        if (chatId == null) {
            return;
        }
        Query query = new Query(Criteria.where("chatId").is(chatId));
        Update update = new Update().addToSet("deletedFor", userId);
        mongoOperations.updateMulti(query, update, ChatMessage.class);
    }

    public void deleteChatForAll(String senderId, String recipientId) {
        var chatId = chatRoomService.getChatId(senderId, recipientId, false).orElse(null);
        if (chatId == null) {
            return;
        }
        if (imageStorageService != null && imageStorageService.isEnabled()) {
            List<ChatMessage> messages = repository.findByChatId(chatId);
            for (ChatMessage m : messages) {
                if (m.getMessageType() == MessageType.IMAGE && m.getImageKey() != null) {
                    imageStorageService.delete(m.getImageKey());
                }
                if ((m.getMessageType() == MessageType.VIDEO_CIRCLE || m.getMessageType() == MessageType.VOICE)
                        && m.getMediaKey() != null) {
                    imageStorageService.delete(m.getMediaKey());
                }
            }
        }
        repository.deleteByChatId(chatId);
    }

    /**
     * Возвращает страницу изображений для указанного чата.
     * Проверяет, что текущий пользователь является участником чата.
     * Сообщения отсортированы по дате убыванию (самые новые сверху).
     *
     * @param chatId       идентификатор чата
     * @param currentUserId текущий пользователь
     * @param page         номер страницы (0-based)
     * @param size         размер страницы
     */
    public ChatImagesPage findImageMessagesByChat(String chatId, String currentUserId, int page, int size) {
        if (page < 0) {
            page = 0;
        }

        if (size <= 0 || size > 200) {
            size = 60;
        }

        ChatRoom room = chatRoomRepository.findFirstByChatId(chatId)
                .orElseThrow(() -> new ResourceNotFoundException("Chat not found: " + chatId));
        boolean participant = currentUserId.equals(room.getSenderId()) || currentUserId.equals(room.getRecipientId());
        if (!participant) {
            throw new ForbiddenException("You are not a participant of this chat");
        }

        Query query = new Query(Criteria
                .where("chatId").is(chatId)
                .and("messageType").is(MessageType.IMAGE)
                .and("deletedFor").ne(currentUserId));
        query.with(Sort.by(Sort.Direction.DESC, "timestamp"));
        query.skip((long) page * size);
        query.limit(size + 1);

        List<ChatMessage> results = mongoOperations.find(query, ChatMessage.class);

        boolean hasMore = results.size() > size;
        if (hasMore) {
            results = results.subList(0, size);
        }

        enrichWithImageUrls(results);

        return ChatImagesPage.builder()
                .items(results)
                .hasMore(hasMore)
                .nextPage(hasMore ? page + 1 : null)
                .build();
    }

    private void enrichWithImageUrl(ChatMessage message) {
        if (imageStorageService != null && imageStorageService.isEnabled()
                && message != null && message.getMessageType() == MessageType.IMAGE && message.getImageKey() != null) {
            imageStorageService.getPresignedUrl(message.getImageKey()).ifPresent(message::setImageUrl);
        }
    }

    private void enrichWithImageUrls(List<ChatMessage> messages) {
        if (messages != null) {
            messages.forEach(m -> {
                enrichWithImageUrl(m);
                enrichWithMediaUrl(m);
            });
        }
    }

    private void enrichWithMediaUrl(ChatMessage message) {
        if (message == null) return;
        if (message.getMessageType() != MessageType.VIDEO_CIRCLE && message.getMessageType() != MessageType.VOICE) return;
        if (message.getMediaKey() == null || message.getMediaKey().isBlank()) return;
        // Для медиа используем эндпоинт /media/{messageId} (стриминг через прокси с авторизацией)
        message.setMediaDownloadUrl("/media/" + message.getId());
    }
}
