package ru.vkabanov.threadlychat.payload;

import lombok.Data;

@Data
public class PushUnsubscribeRequest {
    private String userId;
    private String endpoint;
}
