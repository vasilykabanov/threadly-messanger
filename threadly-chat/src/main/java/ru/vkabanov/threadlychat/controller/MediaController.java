package ru.vkabanov.threadlychat.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import ru.vkabanov.threadlychat.exception.BadRequestException;
import ru.vkabanov.threadlychat.exception.ForbiddenException;
import ru.vkabanov.threadlychat.model.ChatMessage;
import ru.vkabanov.threadlychat.model.MessageType;
import ru.vkabanov.threadlychat.repository.ChatMessageRepository;
import ru.vkabanov.threadlychat.security.CurrentUser;
import ru.vkabanov.threadlychat.service.ChatMessageService;
import ru.vkabanov.threadlychat.service.ImageStorageService;

import java.io.InputStream;
import java.util.Date;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/media")
@Slf4j
public class MediaController {

    @Autowired(required = false)
    private ImageStorageService imageStorageService;
    @Autowired
    private ChatMessageService chatMessageService;
    @Autowired
    private ChatMessageRepository chatMessageRepository;

    private static final long MAX_MEDIA_SIZE = 50L * 1024 * 1024; // 50 MB
    private static final List<String> ALLOWED_MEDIA_TYPES = List.of(
            "video/webm", "audio/webm", "audio/ogg", "video/mp4", "audio/mp4"
    );

    /**
     * Загрузка медиафайла (голосовое сообщение или видеокружок).
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ChatMessage> uploadMedia(
            @RequestParam("file") MultipartFile file,
            @RequestParam("chatId") String chatId,
            @RequestParam("senderId") String senderId,
            @RequestParam("recipientId") String recipientId,
            @RequestParam("messageType") String messageTypeStr,
            @AuthenticationPrincipal CurrentUser currentUser) {

        if (currentUser == null || !currentUser.getUserId().equals(senderId)) {
            throw new ForbiddenException("Access denied");
        }

        if (imageStorageService == null || !imageStorageService.isEnabled()) {
            throw new BadRequestException("Хранилище файлов недоступно");
        }

        MessageType messageType;
        try {
            messageType = MessageType.valueOf(messageTypeStr);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Неверный тип сообщения: " + messageTypeStr);
        }

        if (messageType != MessageType.VIDEO_CIRCLE && messageType != MessageType.VOICE) {
            throw new BadRequestException("Этот эндпоинт только для VOICE и VIDEO_CIRCLE");
        }

        validateMediaFile(file);

        String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
        String extension = extensionFromContentType(contentType);
        String objectKey = "media/" + chatId + "/" + UUID.randomUUID() + "." + extension;

        try (InputStream is = file.getInputStream()) {
            imageStorageService.upload(is, file.getSize(), contentType, objectKey);
        } catch (Exception e) {
            log.error("Media upload failed for chat {}: {}", chatId, e.getMessage());
            throw new BadRequestException("Не удалось загрузить файл");
        }

        String contentText = messageType == MessageType.VIDEO_CIRCLE
                ? "🔵 Видеосообщение"
                : "🎤 Голосовое сообщение";

        ChatMessage message = ChatMessage.builder()
                .chatId(chatId)
                .senderId(senderId)
                .recipientId(recipientId)
                .content(contentText)
                .messageType(messageType)
                .mediaKey(objectKey)
                .timestamp(new Date())
                .build();

        ChatMessage saved = chatMessageService.sendMessage(message);
        return ResponseEntity.ok(saved);
    }

    /**
     * Стриминг медиафайла (audio/video) по ID сообщения.
     */
    @GetMapping("/{messageId}")
    public ResponseEntity<StreamingResponseBody> getMedia(
            @PathVariable String messageId,
            @AuthenticationPrincipal CurrentUser currentUser) {

        if (currentUser == null) {
            throw new ForbiddenException("Access denied");
        }

        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new BadRequestException("Сообщение не найдено"));

        boolean participant = currentUser.getUserId().equals(message.getSenderId())
                || currentUser.getUserId().equals(message.getRecipientId());
        if (!participant) {
            throw new ForbiddenException("Доступ запрещён");
        }

        if (message.getMediaKey() == null || message.getMediaKey().isBlank()) {
            return ResponseEntity.notFound().build();
        }

        return imageStorageService.getObjectStream(message.getMediaKey())
                .map(result -> {
                    MediaType mediaType = MediaType.parseMediaType(result.getContentType());
                    StreamingResponseBody body = outputStream -> {
                        try (InputStream in = result.getStream()) {
                            in.transferTo(outputStream);
                        }
                    };
                    return ResponseEntity.ok()
                            .contentType(mediaType)
                            .header("Cache-Control", "private, max-age=3600")
                            .body(body);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private void validateMediaFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Файл не предоставлен");
        }
        if (file.getSize() > MAX_MEDIA_SIZE) {
            throw new BadRequestException("Размер файла не более 50 МБ");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_MEDIA_TYPES.contains(contentType.toLowerCase())) {
            throw new BadRequestException("Недопустимый тип файла. Разрешены: video/webm, audio/webm, audio/ogg");
        }
    }

    private String extensionFromContentType(String contentType) {
        if (contentType == null) return "webm";
        return switch (contentType.toLowerCase()) {
            case "audio/ogg" -> "ogg";
            case "video/mp4", "audio/mp4" -> "mp4";
            default -> "webm";
        };
    }
}
