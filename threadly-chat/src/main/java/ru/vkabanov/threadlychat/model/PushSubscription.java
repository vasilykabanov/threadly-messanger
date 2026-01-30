package ru.vkabanov.threadlychat.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Document(collection = "push_subscriptions")
public class PushSubscription {
    @Id
    private String id;
    private String userId;
    private String endpoint;
    private String p256dh;
    private String auth;
    private String userAgent;
    private Date createdAt;
}
