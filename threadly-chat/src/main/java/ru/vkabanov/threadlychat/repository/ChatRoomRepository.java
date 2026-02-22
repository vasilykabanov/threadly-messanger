package ru.vkabanov.threadlychat.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import ru.vkabanov.threadlychat.model.ChatRoom;

import java.util.Optional;

public interface ChatRoomRepository extends MongoRepository<ChatRoom, String> {
    Optional<ChatRoom> findBySenderIdAndRecipientId(String senderId, String recipientId);

    Optional<ChatRoom> findFirstByChatId(String chatId);
}
