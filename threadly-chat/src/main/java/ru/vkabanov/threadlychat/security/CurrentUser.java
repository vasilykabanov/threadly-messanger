package ru.vkabanov.threadlychat.security;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * Principal после проверки JWT — хранит userId текущего пользователя.
 */
@Getter
@RequiredArgsConstructor
public class CurrentUser {

    private final String userId;

    private final String username;
}