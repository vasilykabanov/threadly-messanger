package ru.vkabanov.threadlychat.payload;

import lombok.Data;

@Data
public class PushSubscribeRequest {
    private String userId;
    private String endpoint;
    private Keys keys;
    private String userAgent;

    @Data
    public static class Keys {
        private String p256dh;
        private String auth;
    }
}
