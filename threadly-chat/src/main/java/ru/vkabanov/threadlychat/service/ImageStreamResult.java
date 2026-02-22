package ru.vkabanov.threadlychat.service;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.io.InputStream;

/** Результат открытия объекта в хранилище: поток и MIME-тип. Поток нужно закрыть после использования. */
@Getter
@RequiredArgsConstructor
public class ImageStreamResult {

    private final InputStream stream;

    private final String contentType;
}
