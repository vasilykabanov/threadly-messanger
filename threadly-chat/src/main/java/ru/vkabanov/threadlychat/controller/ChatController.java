package ru.vkabanov.threadlychat.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import ru.vkabanov.threadlychat.model.ChatMessage;
import ru.vkabanov.threadlychat.service.ChatMessageService;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class ChatController {

    private final ChatMessageService chatMessageService;

    @GetMapping(value = "/messages/{senderId}/{recipientId}/count", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Long> countNewMessages(@PathVariable String senderId,
                                                 @PathVariable String recipientId) {
        return ResponseEntity.ok(chatMessageService.countNewMessages(senderId, recipientId));
    }

    @GetMapping(value = "/messages/{senderId}/{recipientId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<ChatMessage>> findChatMessages(@PathVariable String senderId,
                                                              @PathVariable String recipientId) {
        return ResponseEntity.ok(chatMessageService.findChatMessages(senderId, recipientId));
    }

    @GetMapping(value = "/messages/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ChatMessage> findMessage(@PathVariable String id) {
        return ResponseEntity.ok(chatMessageService.findById(id));
    }

    @GetMapping(value = "/messages/contacts/{userId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<String>> findChatContacts(@PathVariable String userId) {
        return ResponseEntity.ok(chatMessageService.findContactIds(userId));
    }
}
