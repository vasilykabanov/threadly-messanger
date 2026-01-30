package ru.vkabanov.threadlychat.configuration;

import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import ru.vkabanov.threadlychat.controller.WsController;

@Component
@RequiredArgsConstructor
public class WebSocketEventListener {

    private final WsController wsController;

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String userId = accessor.getFirstNativeHeader("userId"); // передаем userId при подключении

        if (userId != null) {
            // Сохраняем userId в сессию, чтобы получить его при disconnect
            accessor.getSessionAttributes().put("userId", userId);
            wsController.updateStatus(userId, "online");
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String userId = (String) accessor.getSessionAttributes().get("userId");

        if (userId != null) {
            wsController.updateStatus(userId, "offline");
        }
    }
}
