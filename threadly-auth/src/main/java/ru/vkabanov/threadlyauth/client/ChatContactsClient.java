package ru.vkabanov.threadlyauth.client;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Клиент к chat-сервису для получения списка ID пользователей, с которыми у пользователя есть переписка.
 * Chat требует JWT — передаём заголовок Authorization от клиента.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class ChatContactsClient {

    @Value("${app.chat-service-url}")
    private String chatServiceUrl;

    private final RestTemplate restTemplate;

    /**
     * Возвращает список ID пользователей, с которыми у userId есть переписка.
     * authorization — заголовок Authorization от запроса клиента (Bearer token), чтобы chat принял вызов.
     * При ошибке (chat недоступен, 401 и т.д.) возвращает пустой список.
     */
    public List<String> getContactIds(String userId, String authorization) {
        String url = chatServiceUrl + "/messages/contacts/" + userId;
        try {
            HttpHeaders headers = new HttpHeaders();
            if (authorization != null && !authorization.isBlank()) {
                headers.set("Authorization", authorization);
            }
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            return restTemplate.exchange(url, HttpMethod.GET, entity, new ParameterizedTypeReference<List<String>>() {})
                    .getBody();
        } catch (Exception e) {
            log.warn("Failed to fetch contact ids from chat service for user {}: {}", userId, e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * Уведомляет chat-сервис об обновлении аватара пользователя.
     * Chat далее рассылает событие по WebSocket.
     */
    public void notifyAvatarUpdated(String userId, String avatarUrl) {
        String url = chatServiceUrl + "/internal/avatar-updated";
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, String>> entity = new HttpEntity<>(
                    Map.of("userId", userId, "avatarUrl", avatarUrl),
                    headers
            );
            restTemplate.exchange(url, HttpMethod.POST, entity, Void.class);
        } catch (Exception e) {
            log.warn("Failed to notify chat service about avatar update for user {}: {}", userId, e.getMessage());
        }
    }
}
