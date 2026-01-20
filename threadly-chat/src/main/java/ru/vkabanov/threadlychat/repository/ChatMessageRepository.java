package ru.vkabanov.threadlychat.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import ru.vkabanov.threadlychat.model.ChatMessage;
import ru.vkabanov.threadlychat.model.MessageStatus;

import java.util.List;

public interface ChatMessageRepository extends MongoRepository<ChatMessage, String> {

    long countBySenderIdAndRecipientIdAndStatus(String senderId, String recipientId, MessageStatus status);

    List<ChatMessage> findByChatId(String chatId);
}