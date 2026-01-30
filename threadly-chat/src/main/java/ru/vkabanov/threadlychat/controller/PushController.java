package ru.vkabanov.threadlychat.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.vkabanov.threadlychat.payload.PushSubscribeRequest;
import ru.vkabanov.threadlychat.payload.PushUnsubscribeRequest;
import ru.vkabanov.threadlychat.service.PushNotificationService;

import java.util.Map;

@RestController
@RequestMapping("/push")
@RequiredArgsConstructor
public class PushController {

    private final PushNotificationService pushNotificationService;

    @GetMapping("/vapid-public-key")
    public ResponseEntity<Map<String, String>> getVapidPublicKey() {
        if (!pushNotificationService.isEnabled()) {
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
                    .body(Map.of("publicKey", ""));
        }
        return ResponseEntity.ok(Map.of("publicKey", pushNotificationService.getPublicKey()));
    }

    @PostMapping("/subscribe")
    public ResponseEntity<Void> subscribe(@RequestBody PushSubscribeRequest request) {
        if (!pushNotificationService.isEnabled()) {
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
        }
        pushNotificationService.saveSubscription(request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/unsubscribe")
    public ResponseEntity<Void> unsubscribe(@RequestBody PushUnsubscribeRequest request) {
        if (request != null) {
            pushNotificationService.removeSubscription(request.getEndpoint());
        }
        return ResponseEntity.ok().build();
    }
}
