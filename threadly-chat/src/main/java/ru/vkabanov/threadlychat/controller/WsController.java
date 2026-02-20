package ru.vkabanov.threadlychat.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import ru.vkabanov.threadlychat.model.ChatMessage;
import ru.vkabanov.threadlychat.service.ChatMessageService;
import ru.vkabanov.threadlychat.service.UserStatusService;

import java.util.Map;

@Slf4j
@Controller
@RequiredArgsConstructor
public class WsController {

    private final SimpMessagingTemplate messagingTemplate;

    private final UserStatusService userStatusService;

    private final ChatMessageService chatMessageService;

    @MessageMapping("/chat")
    public void processMessage(@Payload ChatMessage chatMessage) {
        ChatMessage saved = chatMessageService.sendMessage(chatMessage);
        messagingTemplate.convertAndSendToUser(chatMessage.getSenderId(), "/queue/sent-ack", saved);
    }

    public void updateStatus(String userId, String status) {
        userStatusService.setStatus(userId, status);
    }

    /**
     * Heartbeat от клиента: обновляет lastSeen и поддерживает статус online.
     * userId берётся из сессии (устанавливается при CONNECT).
     */
    @MessageMapping("/status")
    public void heartbeat(StompHeaderAccessor accessor) {
        if (accessor == null) return;
        Map<String, Object> attrs = accessor.getSessionAttributes();
        if (attrs == null) return;
        String userId = (String) attrs.get("userId");
        userStatusService.setOnlineFromHeartbeat(userId);
    }
}
