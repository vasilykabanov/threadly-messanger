package ru.vkabanov.threadlychat.service;

import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;

@Service
public class UserStatusService {

    private final ConcurrentHashMap<String, String> statuses = new ConcurrentHashMap<>();

    public void setStatus(String userId, String status) {
        statuses.put(userId, status);
    }

    public String getStatus(String userId) {
        return statuses.getOrDefault(userId, "offline");
    }

    public ConcurrentHashMap<String, String> getAllStatuses() {
        return statuses;
    }
}
