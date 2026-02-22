package ru.vkabanov.threadlychat.service;

import java.io.InputStream;
import java.util.Optional;

public interface ImageStorageService {

    /**
     * Загружает файл в хранилище по заданному ключу.
     *
     * @param inputStream содержимое файла
     * @param size        размер в байтах
     * @param contentType MIME-тип (image/jpeg, image/png, image/webp)
     * @param objectKey   уникальный ключ объекта (например chats/chatId/uuid.jpg)
     * @return ключ загруженного объекта
     */
    String upload(InputStream inputStream, long size, String contentType, String objectKey);

    /**
     * Открывает поток чтения объекта. Вызывающий обязан закрыть поток после использования.
     */
    Optional<ImageStreamResult> getObjectStream(String objectKey);

    /**
     * Возвращает presigned URL для чтения объекта (временная ссылка с подписью).
     *
     * @param objectKey ключ объекта в хранилище
     * @return URL с ограниченным сроком действия или empty, если ключ пустой или хранилище отключено
     */
    Optional<String> getPresignedUrl(String objectKey);

    /**
     * Удаляет объект из хранилища.
     *
     * @param objectKey ключ объекта
     */
    void delete(String objectKey);

    /**
     * Проверка, доступно ли хранилище (включено конфигурацией и инициализировано).
     */
    boolean isEnabled();
}
