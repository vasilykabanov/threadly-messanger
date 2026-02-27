package ru.vkabanov.threadlychat.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import ru.vkabanov.threadlychat.model.ChatRoom;
import ru.vkabanov.threadlychat.repository.ChatRoomRepository;

import java.util.Optional;

@Service
public class ChatRoomService {

    @Autowired
    private ChatRoomRepository chatRoomRepository;

    public Optional<String> getChatId(String senderId, String recipientId, boolean createIfNotExist) {
        return chatRoomRepository.findBySenderIdAndRecipientId(senderId, recipientId)
                .map(ChatRoom::getChatId)
                .or(() -> {
                    if (!createIfNotExist) {
                        return Optional.empty();
                    }
                    var chatId = String.format("%s_%s", senderId, recipientId);

                    ChatRoom senderRecipient = ChatRoom
                            .builder()
                            .chatId(chatId)
                            .senderId(senderId)
                            .recipientId(recipientId)
                            .build();
                    chatRoomRepository.save(senderRecipient);

                    // For normal chats (different users) create the reverse mapping too
                    if (!senderId.equals(recipientId)) {
                        ChatRoom recipientSender = ChatRoom
                                .builder()
                                .chatId(chatId)
                                .senderId(recipientId)
                                .recipientId(senderId)
                                .build();
                        chatRoomRepository.save(recipientSender);
                    }

                    return Optional.of(chatId);
                });
    }
}
