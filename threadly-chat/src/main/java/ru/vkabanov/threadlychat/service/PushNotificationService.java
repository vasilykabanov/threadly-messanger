package ru.vkabanov.threadlychat.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.springframework.stereotype.Service;
import ru.vkabanov.threadlychat.configuration.PushConfig;
import ru.vkabanov.threadlychat.model.PushSubscriptionEntity;
import ru.vkabanov.threadlychat.repository.PushSubscriptionRepository;

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

    public void sendToUser(String userId, Map<String, Object> payload) {
        if (pushProperties.getVapid().getPublicKey() == null || pushProperties.getVapid().getPublicKey().isBlank()) {
            return;
        }
        List<PushSubscriptionEntity> subs = subscriptionRepository.findByUserId(userId);
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
                Notification notification = new Notification(
                        sub.getEndpoint(),
                        sub.getP256dh(),
                        sub.getAuth(),
                        body
                );
                pushService.send(notification);
            } catch (Exception e) {
                log.warn("Failed to send push to userId={}, endpoint={}: {}", userId, sub.getEndpoint(), e.getMessage());
            }
        }
    }
}

