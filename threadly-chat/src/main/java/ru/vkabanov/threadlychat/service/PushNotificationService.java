package ru.vkabanov.threadlychat.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Subscription;
import nl.martijndwars.webpush.Utils;
import nl.martijndwars.webpush.WebPushException;
import org.apache.http.HttpResponse;
import org.apache.http.util.EntityUtils;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import ru.vkabanov.threadlychat.model.ChatMessage;
import ru.vkabanov.threadlychat.model.PushSubscription;
import ru.vkabanov.threadlychat.payload.PushSubscribeRequest;
import ru.vkabanov.threadlychat.repository.PushSubscriptionRepository;

import javax.annotation.PostConstruct;
import java.security.Security;
import java.util.Date;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PushNotificationService {

    private final PushSubscriptionRepository repository;
    private final ObjectMapper objectMapper;

    @Value("${push.vapid.public-key:}")
    private String vapidPublicKey;

    @Value("${push.vapid.private-key:}")
    private String vapidPrivateKey;

    @Value("${push.vapid.subject:}")
    private String vapidSubject;

    private PushService pushService;

    @PostConstruct
    public void init() {
        if (vapidPublicKey == null || vapidPublicKey.isBlank() || vapidPrivateKey == null || vapidPrivateKey.isBlank()) {
            log.warn("Push notifications are disabled: missing VAPID keys.");
            return;
        }

        try {
            Security.addProvider(new BouncyCastleProvider());
            pushService = new PushService();
            pushService.setPublicKey(Utils.loadPublicKey(vapidPublicKey));
            pushService.setPrivateKey(Utils.loadPrivateKey(vapidPrivateKey));
            pushService.setSubject((vapidSubject == null || vapidSubject.isBlank())
                    ? "mailto:admin@localhost"
                    : vapidSubject);
        } catch (Exception e) {
            log.error("Failed to initialize push service", e);
            pushService = null;
        }
    }

    public boolean isEnabled() {
        return pushService != null;
    }

    public String getPublicKey() {
        return vapidPublicKey;
    }

    public void saveSubscription(PushSubscribeRequest request) {
        if (request == null || request.getEndpoint() == null || request.getEndpoint().isBlank()) {
            return;
        }

        PushSubscription subscription = repository.findByEndpoint(request.getEndpoint())
                .orElse(PushSubscription.builder().createdAt(new Date()).build());

        subscription.setUserId(request.getUserId());
        subscription.setEndpoint(request.getEndpoint());
        subscription.setP256dh(request.getKeys() != null ? request.getKeys().getP256dh() : null);
        subscription.setAuth(request.getKeys() != null ? request.getKeys().getAuth() : null);
        subscription.setUserAgent(request.getUserAgent());

        repository.save(subscription);
    }

    public void removeSubscription(String endpoint) {
        if (endpoint == null || endpoint.isBlank()) {
            return;
        }
        repository.deleteByEndpoint(endpoint);
    }

    @Async
    public void sendNewMessage(ChatMessage message) {
        if (!isEnabled() || message == null) {
            return;
        }

        List<PushSubscription> subscriptions = repository.findAllByUserId(message.getRecipientId());
        if (subscriptions.isEmpty()) {
            return;
        }

        String body = buildBody(message);
        PushPayload payload = new PushPayload("Новое сообщение!", body, "/chat", message.getId(), message.getSenderId(), message.getRecipientId());

        try {
            String jsonPayload = objectMapper.writeValueAsString(payload);
            for (PushSubscription subscription : subscriptions) {
                sendNotification(subscription, jsonPayload);
            }
        } catch (Exception e) {
            log.error("Failed to serialize push payload", e);
        }
    }

    private String buildBody(ChatMessage message) {
        String sender = message.getSenderName() == null ? "Неизвестно" : message.getSenderName();
        String content = message.getContent() == null ? "" : message.getContent();
        String compact = content.length() > 160 ? content.substring(0, 160) + "…" : content;
        return sender + ": " + compact;
    }

    private void sendNotification(PushSubscription subscription, String payload) {
        if (subscription.getEndpoint() == null || subscription.getEndpoint().isBlank()) {
            return;
        }

        if (subscription.getP256dh() == null || subscription.getP256dh().isBlank()
                || subscription.getAuth() == null || subscription.getAuth().isBlank()) {
            return;
        }

        try {
            Subscription.Keys keys = new Subscription.Keys(subscription.getP256dh(), subscription.getAuth());
            Subscription sub = new Subscription(subscription.getEndpoint(), keys);
            Notification notification = new Notification(sub, payload);
            pushService.send(notification);
        } catch (WebPushException e) {
            HttpResponse response = e.getHttpResponse();
            if (response != null) {
                int statusCode = response.getStatusLine().getStatusCode();
                String reason = response.getStatusLine().getReasonPhrase();
                String body = "";
                try {
                    if (response.getEntity() != null) {
                        body = EntityUtils.toString(response.getEntity());
                    }
                } catch (Exception ignored) {
                }

                log.warn("Push error {} {} for endpoint {}. Body: {}",
                        statusCode,
                        reason,
                        subscription.getEndpoint(),
                        body);

                if (statusCode == 404 || statusCode == 410) {
                    log.info("Removing expired push subscription: {}", subscription.getEndpoint());
                    repository.deleteByEndpoint(subscription.getEndpoint());
                    return;
                }
            }
            log.warn("Failed to send push notification", e);
        } catch (Exception e) {
            log.error("Failed to send push notification", e);
        }
    }

    @Data
    @AllArgsConstructor
    private static class PushPayload {
        private String title;
        private String body;
        private String url;
        private String messageId;
        private String senderId;
        private String recipientId;
    }
}
