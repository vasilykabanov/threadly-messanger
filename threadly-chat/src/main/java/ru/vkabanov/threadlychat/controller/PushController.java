package ru.vkabanov.threadlychat.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.vkabanov.threadlychat.exception.ForbiddenException;
import ru.vkabanov.threadlychat.payload.PushSubscribeRequest;
import ru.vkabanov.threadlychat.payload.PushUnsubscribeRequest;
import ru.vkabanov.threadlychat.security.CurrentUser;
import ru.vkabanov.threadlychat.service.PushNotificationService;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@Slf4j
public class PushController {

    private final PushNotificationService pushNotificationService;

    @GetMapping(value = "/push/vapid-public-key", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, String>> getVapidPublicKey() {
        return ResponseEntity.ok(Map.of("publicKey", pushNotificationService.getPublicKey()));
    }

    @PostMapping(value = "/push/subscribe", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Void> subscribe(@RequestBody PushSubscribeRequest request,
                                          @AuthenticationPrincipal CurrentUser currentUser) {
        if (request.getUserId() == null || request.getEndpoint() == null || request.getKeys() == null) {
            return ResponseEntity.badRequest().build();
        }
        if (currentUser == null) {
            log.warn("push/subscribe: no principal for request userId={}", request.getUserId());
            throw new ForbiddenException("Can only subscribe for your own user");
        }
        if (!currentUser.getUserId().equals(request.getUserId())) {
            log.warn("push/subscribe: request userId={} != JWT userId={}", request.getUserId(), currentUser.getUserId());
            throw new ForbiddenException("Can only subscribe for your own user");
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
    public ResponseEntity<Void> unsubscribe(@RequestBody PushUnsubscribeRequest request,
                                            @AuthenticationPrincipal CurrentUser currentUser) {
        if (request.getUserId() == null || request.getEndpoint() == null) {
            return ResponseEntity.badRequest().build();
        }
        if (!currentUser.getUserId().equals(request.getUserId())) {
            throw new ForbiddenException("Can only unsubscribe for your own user");
        }
        pushNotificationService.removeSubscription(request.getUserId(), request.getEndpoint());
        return ResponseEntity.ok().build();
    }

    @PostMapping(value = "/push/unsubscribe-all/{userId}")
    public ResponseEntity<Void> unsubscribeAll(@PathVariable String userId,
                                               @AuthenticationPrincipal CurrentUser currentUser) {
        if (!currentUser.getUserId().equals(userId)) {
            throw new ForbiddenException("Can only unsubscribe all for your own user");
        }
        pushNotificationService.removeAllSubscriptions(userId);
        return ResponseEntity.ok().build();
    }
}

