package ru.vkabanov.threadlychat.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Encoding;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.apache.http.util.EntityUtils;
import org.springframework.stereotype.Service;
import ru.vkabanov.threadlychat.configuration.PushConfig;
import ru.vkabanov.threadlychat.model.PushSubscriptionEntity;
import ru.vkabanov.threadlychat.repository.PushSubscriptionRepository;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class PushNotificationService {

    private final PushService pushService;
    private final PushConfig.PushProperties pushProperties;
    private final PushSubscriptionRepository subscriptionRepository;
    private final ObjectMapper objectMapper;

    public String getPublicKey() {
        return pushProperties.getVapid().getPublicKey();
    }

    public void upsertSubscription(String userId, String endpoint, String p256dh, String auth) {
        // Упрощённый upsert: удаляем по (userId, endpoint) и создаём заново
        subscriptionRepository.deleteByUserIdAndEndpoint(userId, endpoint);
        subscriptionRepository.save(PushSubscriptionEntity.builder()
                .userId(userId)
                .endpoint(endpoint)
                .p256dh(p256dh)
                .auth(auth)
                .build());
    }

    public void removeSubscription(String userId, String endpoint) {
        subscriptionRepository.deleteByUserIdAndEndpoint(userId, endpoint);
    }

    public void removeAllSubscriptions(String userId) {
        List<PushSubscriptionEntity> subs = subscriptionRepository.findByUserId(userId);
        log.info("[Push] Removing all {} subscriptions for userId={}", subs.size(), userId);
        subscriptionRepository.deleteAll(subs);
    }

    public void sendToUser(String userId, Map<String, Object> payload) {
        if (pushProperties.getVapid().getPublicKey() == null || pushProperties.getVapid().getPublicKey().isBlank()) {
            log.info("[Push] VAPID key not configured, skipping");
            return;
        }
        List<PushSubscriptionEntity> subs = subscriptionRepository.findByUserId(userId);
        log.info("[Push] Sending to userId={}, found {} subscription(s)", userId, subs.size());
        if (subs.isEmpty()) return;

        byte[] body;
        try {
            body = objectMapper.writeValueAsBytes(payload);
        } catch (Exception e) {
            log.warn("Failed to serialize push payload for userId={}: {}", userId, e.getMessage());
            return;
        }

        for (PushSubscriptionEntity sub : subs) {
            try {
                Notification notification = Notification.builder()
                        .endpoint(sub.getEndpoint())
                        .userPublicKey(sub.getP256dh())
                        .userAuth(sub.getAuth())
                        .payload(body)
                        .ttl(86400) // 24 часа
                        .build();
                var response = pushService.send(notification, Encoding.AES128GCM);
                int statusCode = response.getStatusLine().getStatusCode();
                
                if (statusCode == 201) {
                    log.info("[Push] Successfully sent (201) to userId={}, endpoint={}", userId, sub.getEndpoint().substring(0, Math.min(50, sub.getEndpoint().length())) + "...");
                } else if (statusCode == 410) {
                    // Gone — endpoint устарел, удаляем подписку
                    log.warn("[Push] Endpoint expired (410), removing subscription for userId={}", userId);
                    subscriptionRepository.delete(sub);
                } else if (statusCode == 403) {
                    // Forbidden — VAPID key mismatch или невалидная подписка
                    String responseBody = "";
                    try {
                        responseBody = EntityUtils.toString(response.getEntity(), StandardCharsets.UTF_8);
                    } catch (Exception ignored) {}
                    log.warn("[Push] Forbidden (403), removing subscription for userId={}. Response: {}", userId, responseBody);
                    subscriptionRepository.delete(sub);
                } else {
                    String responseBody = "";
                    try {
                        responseBody = EntityUtils.toString(response.getEntity(), StandardCharsets.UTF_8);
                    } catch (Exception ignored) {}
                    log.warn("[Push] Unexpected response {} for userId={}, endpoint={}. Body: {}", statusCode, userId, sub.getEndpoint(), responseBody);
                }
            } catch (Exception e) {
                log.warn("[Push] Failed to send to userId={}, endpoint={}: {}", userId, sub.getEndpoint(), e.getMessage());
            }
        }
    }
}

