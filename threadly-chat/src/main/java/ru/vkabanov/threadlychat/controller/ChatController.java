package ru.vkabanov.threadlychat.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import ru.vkabanov.threadlychat.exception.ForbiddenException;
import ru.vkabanov.threadlychat.model.ChatMessage;
import ru.vkabanov.threadlychat.model.ChatImagesPage;
import ru.vkabanov.threadlychat.model.ChatMessagesPage;
import ru.vkabanov.threadlychat.security.CurrentUser;
import ru.vkabanov.threadlychat.service.ChatMessageService;
import ru.vkabanov.threadlychat.service.ChatGroupService;
import ru.vkabanov.threadlychat.service.ImageMessageService;
import ru.vkabanov.threadlychat.service.UserStatusService;

import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@Slf4j
public class ChatController {

    private final ChatMessageService chatMessageService;
    private final UserStatusService userStatusService;
    private final ImageMessageService imageMessageService;
    private final ChatGroupService chatGroupService;

    @GetMapping(value = "/messages/{senderId}/{recipientId}/count", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Long> countNewMessages(@PathVariable String senderId, @PathVariable String recipientId,
                                                 @AuthenticationPrincipal CurrentUser currentUser) {
        ensureParticipant(currentUser.getUserId(), senderId, recipientId);
        return ResponseEntity.ok(chatMessageService.countNewMessages(senderId, recipientId));
    }

    @GetMapping(value = "/messages/{senderId}/{recipientId}/page", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ChatMessagesPage> findChatMessagesPage(@PathVariable String senderId,
                                                                 @PathVariable String recipientId,
                                                                 @RequestParam(defaultValue = "0") int page,
                                                                 @RequestParam(defaultValue = "50") int size,
                                                                 @AuthenticationPrincipal CurrentUser currentUser) {
        ensureParticipant(currentUser.getUserId(), senderId, recipientId);
        return ResponseEntity.ok(chatMessageService.findChatMessagesPage(senderId, recipientId, page, size));
    }

    @GetMapping(value = "/messages/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ChatMessage> findMessage(@PathVariable String id,
                                                   @AuthenticationPrincipal CurrentUser currentUser) {
        ChatMessage message = chatMessageService.findById(id);
        // Для групповых сообщений проверяем участие в группе
        if (message.getChatId() != null && message.getChatId().startsWith("group_")) {
            String groupId = message.getChatId().substring(6);
            chatGroupService.getGroup(groupId, currentUser.getUserId());
        } else {
            ensureParticipant(currentUser.getUserId(), message.getSenderId(), message.getRecipientId());
        }
        return ResponseEntity.ok(message);
    }

    /**
     * Загрузка изображения в чат.
     * multipart/form-data: file (файл), chatId (идентификатор чата).
     * Возвращает созданное сообщение с полем imageUrl (presigned URL).
     */
    @PostMapping(value = "/messages/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ChatMessage> uploadImage(@RequestParam("file") MultipartFile file,
                                                    @RequestParam("chatId") String chatId,
                                                    @AuthenticationPrincipal CurrentUser currentUser) {
        ChatMessage message = imageMessageService.sendImageMessage(currentUser, chatId, file);
        return ResponseEntity.ok(message);
    }

    /**
     * Получить временную (presigned) ссылку на изображение сообщения.
     * Доступ только для участников чата.
     */
    @GetMapping(value = "/messages/{id}/image-url", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, String>> getImageUrl(@PathVariable String id,
                                                           @AuthenticationPrincipal CurrentUser currentUser) {
        return imageMessageService.getImageUrl(id, currentUser)
                .map(url -> ResponseEntity.ok(Map.of("url", url)))
                .orElse(ResponseEntity.noContent().build());
    }

    /**
     * Прокси изображения сообщения (same-origin, обход ORB). Участник чата проверяется по JWT.
     */
    @GetMapping(value = "/messages/{id}/image")
    public ResponseEntity<StreamingResponseBody> getMessageImage(@PathVariable String id,
                                                                 @AuthenticationPrincipal CurrentUser currentUser) {
        return imageMessageService.getImageStream(id, currentUser)
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

    @GetMapping(value = "/messages/contacts/{userId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<String>> findChatContacts(@PathVariable String userId,
                                                         @AuthenticationPrincipal CurrentUser currentUser) {
        if (currentUser == null) {
            log.warn("contacts/{}: no principal (JWT missing or invalid)", userId);
            throw new ForbiddenException("Access denied to another user's contacts");
        }
        if (!currentUser.getUserId().equals(userId)) {
            log.warn("contacts: path userId={} != JWT userId={}", userId, currentUser.getUserId());
            throw new ForbiddenException("Access denied to another user's contacts");
        }
        return ResponseEntity.ok(chatMessageService.findContactIds(userId));
    }

    @GetMapping(value = "/messages/unread-counts/{userId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Long>> getUnreadCounts(@PathVariable String userId,
                                                             @AuthenticationPrincipal CurrentUser currentUser) {
        if (currentUser == null) {
            log.warn("unread-counts/{}: no principal", userId);
            throw new ForbiddenException("Access denied to another user's unread counts");
        }
        if (!currentUser.getUserId().equals(userId)) {
            log.warn("unread-counts: path userId={} != JWT userId={}", userId, currentUser.getUserId());
            throw new ForbiddenException("Access denied to another user's unread counts");
        }
        return ResponseEntity.ok(chatMessageService.getUnreadCountsByContact(userId));
    }

    /**
     * Статусы контактов текущего пользователя (online/offline).
     * Используется при загрузке чата и для синхронизации с /topic/status.
     */
    @GetMapping(value = "/messages/statuses/{userId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, String>> getStatuses(@PathVariable String userId,
                                                           @AuthenticationPrincipal CurrentUser currentUser) {
        if (currentUser == null) {
            log.warn("statuses/{}: no principal", userId);
            throw new ForbiddenException("Access denied to another user's statuses");
        }
        if (!currentUser.getUserId().equals(userId)) {
            log.warn("statuses: path userId={} != JWT userId={}", userId, currentUser.getUserId());
            throw new ForbiddenException("Access denied to another user's statuses");
        }
        List<String> contactIds = chatMessageService.findContactIds(userId);
        Map<String, String> statuses = new HashMap<>();
        for (String contactId : contactIds) {
            statuses.put(contactId, userStatusService.getStatus(contactId));
        }
        return ResponseEntity.ok(statuses);
    }

    /**
     * Список изображений чата для вкладки "Фото" в профиле собеседника.
     * Возвращает только сообщения типа IMAGE для указанного chatId,
     * отсортированные по дате убыванию. Поддерживает пагинацию.
     *
     * GET /chats/{chatId}/images?page=0&size=60
     */
    @GetMapping(value = "/chats/{chatId}/images", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ChatImagesPage> getChatImages(@PathVariable String chatId,
                                                        @RequestParam(defaultValue = "0") int page,
                                                        @RequestParam(defaultValue = "60") int size,
                                                        @AuthenticationPrincipal CurrentUser currentUser) {
        if (currentUser == null) {
            log.warn("chat images: no principal for chatId={}", chatId);
            throw new ForbiddenException("Access denied to chat images");
        }

        ChatImagesPage result = chatMessageService.findImageMessagesByChat(chatId, currentUser.getUserId(), page, size);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping(value = "/messages/{senderId}/{recipientId}")
    public ResponseEntity<Void> deleteChat(@PathVariable String senderId,
                                           @PathVariable String recipientId,
                                           @RequestParam String userId,
                                           @RequestParam(defaultValue = "me") String scope,
                                           @AuthenticationPrincipal CurrentUser currentUser) {
        if ("all".equalsIgnoreCase(scope)) {
            ensureParticipant(currentUser.getUserId(), senderId, recipientId);
            chatMessageService.deleteChatForAll(senderId, recipientId);
        } else {
            if (!currentUser.getUserId().equals(userId)) {
                throw new ForbiddenException("Can only delete chat for yourself");
            }
            chatMessageService.deleteChatForUser(senderId, recipientId, userId);
        }
        return ResponseEntity.noContent().build();
    }

    private static void ensureParticipant(String currentUserId, String senderId, String recipientId) {
        boolean isParticipant = currentUserId.equals(senderId) || currentUserId.equals(recipientId);
        if (!isParticipant) {
            throw new ForbiddenException("You are not a participant of this conversation");
        }
    }
}
