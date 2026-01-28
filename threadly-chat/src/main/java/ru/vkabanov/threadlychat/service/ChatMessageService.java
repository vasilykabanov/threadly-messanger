package ru.vkabanov.threadlychat.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import ru.vkabanov.threadlychat.exception.ResourceNotFoundException;
import ru.vkabanov.threadlychat.model.ChatMessage;
import ru.vkabanov.threadlychat.model.MessageStatus;
import ru.vkabanov.threadlychat.repository.ChatMessageRepository;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class ChatMessageService {

    @Autowired
    private ChatMessageRepository repository;
    @Autowired
    private ChatRoomService chatRoomService;
    @Autowired
    private MongoOperations mongoOperations;

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

    public List<ChatMessage> findChatMessages(String senderId, String recipientId) {
        var chatId = chatRoomService.getChatId(senderId, recipientId, false);
        var messages = chatId.map(cId -> repository.findByChatId(cId)).orElse(new ArrayList<>());

        messages = messages.stream()
            .filter(message -> message.getDeletedFor() == null || !message.getDeletedFor().contains(recipientId))
            .toList();

        if (messages.size() > 0) {
            updateStatuses(senderId, recipientId, MessageStatus.DELIVERED);
        }

        return messages;
    }

    public ChatMessage findById(String id) {
        return repository.findById(id)
                .map(chatMessage -> {
                    chatMessage.setStatus(MessageStatus.DELIVERED);
                    return repository.save(chatMessage);
                })
                .orElseThrow(() -> new ResourceNotFoundException("can't find message (" + id + ")"));
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

    public void updateStatuses(String senderId, String recipientId, MessageStatus status) {
        Query query = new Query(Criteria
                .where("senderId").is(senderId)
                .and("recipientId").is(recipientId)
                .and("deletedFor").ne(recipientId));
        Update update = Update.update("status", status);
        mongoOperations.updateMulti(query, update, ChatMessage.class);
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
        repository.deleteByChatId(chatId);
    }
}
