package ru.vkabanov.threadlychat.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "push_subscriptions")
public class PushSubscriptionEntity {

    @Id
    private String id;

    private String userId;

    private String endpoint;

    /**
     * Base64URL string from PushSubscription.getKey("p256dh")
     */
    private String p256dh;

    /**
     * Base64URL string from PushSubscription.getKey("auth")
     */
    private String auth;

    @Builder.Default
    private Instant createdAt = Instant.now();
}

