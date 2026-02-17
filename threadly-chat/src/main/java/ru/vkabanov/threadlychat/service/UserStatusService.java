package ru.vkabanov.threadlychat.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import ru.vkabanov.threadlychat.model.StatusMessage;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Сервис статусов пользователей (online/offline).
 * Поддерживает lastSeen и TTL: при отсутствии heartbeat пользователь помечается offline.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserStatusService {

    private static final long HEARTBEAT_TTL_MS = 90_000L;  // 90 сек без heartbeat → offline
    private static final long TTL_CHECK_INTERVAL_MS = 45_000L;  // проверка каждые 45 сек

    private final ConcurrentHashMap<String, String> statuses = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> lastSeen = new ConcurrentHashMap<>();
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Установить статус и разослать по /topic/status (connect/disconnect).
     */
    public void setStatus(String userId, String status) {
        statuses.put(userId, status);
        if ("offline".equalsIgnoreCase(status)) {
            lastSeen.remove(userId);
        } else {
            lastSeen.put(userId, System.currentTimeMillis());
        }
        broadcast(userId, status);
    }

    /**
     * Отметить пользователя online по heartbeat (без рассылки, только lastSeen).
     * Рассылка делается при connect в WebSocketEventListener.
     */
    public void setOnlineFromHeartbeat(String userId) {
        if (userId == null) return;
        long now = System.currentTimeMillis();
        lastSeen.put(userId, now);
        String prev = statuses.put(userId, "online");
        // Рассылаем только если раньше был не online (восстановление после TTL или первый heartbeat)
        if (!"online".equalsIgnoreCase(prev)) {
            broadcast(userId, "online");
        }
    }

    public String getStatus(String userId) {
        return statuses.getOrDefault(userId, "offline");
    }

    public Long getLastSeen(String userId) {
        return lastSeen.get(userId);
    }

    public Map<String, String> getAllStatuses() {
        return new ConcurrentHashMap<>(statuses);
    }

    /**
     * Периодически помечать offline пользователей, у которых lastSeen старше TTL.
     */
    @Scheduled(fixedRate = TTL_CHECK_INTERVAL_MS)
    public void markOfflineIfStale() {
        long now = System.currentTimeMillis();
        List<String> toOffline = new ArrayList<>();
        lastSeen.forEach((userId, seen) -> {
            if (now - seen > HEARTBEAT_TTL_MS && "online".equalsIgnoreCase(statuses.get(userId))) {
                toOffline.add(userId);
            }
        });
        for (String userId : toOffline) {
            log.debug("Marking user {} offline (no heartbeat for {} ms)", userId, HEARTBEAT_TTL_MS);
            setStatus(userId, "offline");
        }
    }

    private void broadcast(String userId, String status) {
        messagingTemplate.convertAndSend("/topic/status", new StatusMessage(userId, status));
    }
}
