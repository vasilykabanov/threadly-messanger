package ru.vkabanov.threadlychat.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import ru.vkabanov.threadlychat.payload.PushSubscribeRequest;
import ru.vkabanov.threadlychat.payload.PushUnsubscribeRequest;
import ru.vkabanov.threadlychat.service.PushNotificationService;

import java.util.Map;

@RestController
@RequiredArgsConstructor
public class PushController {

    private final PushNotificationService pushNotificationService;

    @GetMapping(value = "/push/vapid-public-key", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, String>> getVapidPublicKey() {
        return ResponseEntity.ok(Map.of("publicKey", pushNotificationService.getPublicKey()));
    }

    @PostMapping(value = "/push/subscribe", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Void> subscribe(@RequestBody PushSubscribeRequest request) {
        if (request.getUserId() == null || request.getEndpoint() == null || request.getKeys() == null) {
            return ResponseEntity.badRequest().build();
        }
        pushNotificationService.upsertSubscription(
                request.getUserId(),
                request.getEndpoint(),
                request.getKeys().getP256dh(),
                request.getKeys().getAuth()
        );
        return ResponseEntity.ok().build();
    }

    @PostMapping(value = "/push/unsubscribe", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Void> unsubscribe(@RequestBody PushUnsubscribeRequest request) {
        if (request.getUserId() == null || request.getEndpoint() == null) {
            return ResponseEntity.badRequest().build();
        }
        pushNotificationService.removeSubscription(request.getUserId(), request.getEndpoint());
        return ResponseEntity.ok().build();
    }

    @PostMapping(value = "/push/unsubscribe-all/{userId}")
    public ResponseEntity<Void> unsubscribeAll(@org.springframework.web.bind.annotation.PathVariable String userId) {
        pushNotificationService.removeAllSubscriptions(userId);
        return ResponseEntity.ok().build();
    }
}

