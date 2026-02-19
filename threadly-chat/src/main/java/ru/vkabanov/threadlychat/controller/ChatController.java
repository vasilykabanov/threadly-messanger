package ru.vkabanov.threadlychat.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.vkabanov.threadlychat.exception.ForbiddenException;
import ru.vkabanov.threadlychat.model.ChatMessage;
import ru.vkabanov.threadlychat.security.CurrentUser;
import ru.vkabanov.threadlychat.service.ChatMessageService;
import ru.vkabanov.threadlychat.service.UserStatusService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@Slf4j
public class ChatController {

    private final ChatMessageService chatMessageService;
    private final UserStatusService userStatusService;

    @GetMapping(value = "/messages/{senderId}/{recipientId}/count", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Long> countNewMessages(@PathVariable String senderId, @PathVariable String recipientId,
                                                 @AuthenticationPrincipal CurrentUser currentUser) {
        ensureParticipant(currentUser.getUserId(), senderId, recipientId);
        return ResponseEntity.ok(chatMessageService.countNewMessages(senderId, recipientId));
    }

    @GetMapping(value = "/messages/{senderId}/{recipientId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<ChatMessage>> findChatMessages(@PathVariable String senderId,
                                                              @PathVariable String recipientId,
                                                              @AuthenticationPrincipal CurrentUser currentUser) {
        ensureParticipant(currentUser.getUserId(), senderId, recipientId);
        return ResponseEntity.ok(chatMessageService.findChatMessages(senderId, recipientId));
    }

    @GetMapping(value = "/messages/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ChatMessage> findMessage(@PathVariable String id,
                                                   @AuthenticationPrincipal CurrentUser currentUser) {
        ChatMessage message = chatMessageService.findById(id);
        ensureParticipant(currentUser.getUserId(), message.getSenderId(), message.getRecipientId());
        return ResponseEntity.ok(message);
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
