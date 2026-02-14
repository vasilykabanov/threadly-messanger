package ru.vkabanov.threadlyauth.client;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.List;

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
}
