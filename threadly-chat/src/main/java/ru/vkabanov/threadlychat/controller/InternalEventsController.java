package ru.vkabanov.threadlychat.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.vkabanov.threadlychat.model.AvatarUpdatedMessage;

@RestController
@RequestMapping("/internal")
@RequiredArgsConstructor
@Slf4j
public class InternalEventsController {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Внутреннее событие от auth-сервиса об обновлении аватара пользователя.
     * Широковещательно отправляется в /topic/avatar-updated.
     */
    @PostMapping("/avatar-updated")
    public ResponseEntity<Void> avatarUpdated(@RequestBody AvatarUpdatedMessage message) {
        if (message.getUserId() == null || message.getAvatarUrl() == null) {
            return ResponseEntity.badRequest().build();
        }
        log.info("Broadcasting avatar_updated for user {}", message.getUserId());
        messagingTemplate.convertAndSend("/topic/avatar-updated", message);
        return ResponseEntity.accepted().build();
    }
}

