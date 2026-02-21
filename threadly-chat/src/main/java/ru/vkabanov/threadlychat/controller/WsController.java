package ru.vkabanov.threadlychat.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import ru.vkabanov.threadlychat.model.ChatMessage;
import ru.vkabanov.threadlychat.model.ChatNotification;
import ru.vkabanov.threadlychat.model.StatusMessage;
import ru.vkabanov.threadlychat.service.ChatMessageService;
import ru.vkabanov.threadlychat.service.ChatRoomService;
import ru.vkabanov.threadlychat.service.PushNotificationService;
import ru.vkabanov.threadlychat.service.UserStatusService;

import java.util.Map;

@Slf4j
@Controller
@RequiredArgsConstructor
public class WsController {

    private final SimpMessagingTemplate messagingTemplate;

    private final UserStatusService userStatusService;

    private final ChatRoomService chatRoomService;

    private final ChatMessageService chatMessageService;

    private final PushNotificationService pushNotificationService;

    @MessageMapping("/chat")
    public void processMessage(@Payload ChatMessage chatMessage) {
        var chatId = chatRoomService.getChatId(chatMessage.getSenderId(), chatMessage.getRecipientId(), true);
        chatMessage.setChatId(chatId.get());

        ChatMessage saved = chatMessageService.save(chatMessage);
        messagingTemplate.convertAndSendToUser(chatMessage.getRecipientId(), "/queue/messages",
                new ChatNotification(saved.getId(), saved.getSenderId(), saved.getSenderName()));

        // Если пользователь не онлайн в вебсокете — шлём web-push
        String recipientStatus = userStatusService.getStatus(chatMessage.getRecipientId());
        log.info("[Push] Recipient {} status: {}", chatMessage.getRecipientId(), recipientStatus);
        if (!"online".equalsIgnoreCase(recipientStatus)) {
            log.info("[Push] Sending push notification to {}", chatMessage.getRecipientId());
            String pushContent = saved.getContent();
            if (saved.getMessageType() != null && !"TEXT".equals(saved.getMessageType())) {
                switch (saved.getMessageType()) {
                    case "VOICE": pushContent = "🎤 Голосовое сообщение"; break;
                    case "IMAGE": pushContent = "📷 Фото"; break;
                    case "VIDEO_CIRCLE": pushContent = "🔵 Видеосообщение"; break;
                    default: break;
                }
            }
            pushNotificationService.sendToUser(chatMessage.getRecipientId(), Map.of(
                    "type", "chat_message",
                    "messageId", saved.getId(),
                    "senderId", saved.getSenderId(),
                    "senderName", saved.getSenderName(),
                    "recipientId", saved.getRecipientId(),
                    "content", pushContent != null ? pushContent : ""
            ));
        }
    }

    public void updateStatus(String userId, String status) {
        userStatusService.setStatus(userId, status);
        messagingTemplate.convertAndSend("/topic/status", new StatusMessage(userId, status));
    }
}
