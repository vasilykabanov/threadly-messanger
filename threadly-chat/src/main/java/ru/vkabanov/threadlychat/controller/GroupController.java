package ru.vkabanov.threadlychat.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import ru.vkabanov.threadlychat.exception.ForbiddenException;
import ru.vkabanov.threadlychat.model.ChatGroup;
import ru.vkabanov.threadlychat.model.ChatMessagesPage;
import ru.vkabanov.threadlychat.security.CurrentUser;
import ru.vkabanov.threadlychat.service.ChatGroupService;

import java.util.*;

@RestController
@RequestMapping("/groups")
@RequiredArgsConstructor
@Slf4j
public class GroupController {

    private final ChatGroupService chatGroupService;

    /**
     * Создать группу.
     * Body: { "name": "...", "memberIds": ["id1", "id2"] }
     */
    @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ChatGroup> createGroup(@RequestBody Map<String, Object> body,
                                                  @AuthenticationPrincipal CurrentUser currentUser) {
        if (currentUser == null) throw new ForbiddenException("Access denied");
        String name = (String) body.get("name");
        @SuppressWarnings("unchecked")
        List<String> memberList = (List<String>) body.getOrDefault("memberIds", Collections.emptyList());
        Set<String> memberIds = new HashSet<>(memberList);

        ChatGroup group = chatGroupService.createGroup(currentUser.getUserId(), name, memberIds);
        return ResponseEntity.ok(group);
    }

    /**
     * Список групп текущего пользователя.
     */
    @GetMapping(value = "/my", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<ChatGroup>> getMyGroups(@AuthenticationPrincipal CurrentUser currentUser) {
        if (currentUser == null) throw new ForbiddenException("Access denied");
        List<ChatGroup> groups = chatGroupService.getUserGroups(currentUser.getUserId());
        groups.forEach(chatGroupService::enrichWithAvatarUrl);
        return ResponseEntity.ok(groups);
    }

    /**
     * Получить группу по ID.
     */
    @GetMapping(value = "/{groupId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ChatGroup> getGroup(@PathVariable String groupId,
                                               @AuthenticationPrincipal CurrentUser currentUser) {
        if (currentUser == null) throw new ForbiddenException("Access denied");
        ChatGroup group = chatGroupService.getGroup(groupId, currentUser.getUserId());
        chatGroupService.enrichWithAvatarUrl(group);
        return ResponseEntity.ok(group);
    }

    /**
     * Переименовать группу.
     * Body: { "name": "New Name" }
     */
    @PutMapping(value = "/{groupId}/rename", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ChatGroup> renameGroup(@PathVariable String groupId,
                                                  @RequestBody Map<String, String> body,
                                                  @AuthenticationPrincipal CurrentUser currentUser) {
        if (currentUser == null) throw new ForbiddenException("Access denied");
        return ResponseEntity.ok(chatGroupService.renameGroup(groupId, currentUser.getUserId(), body.get("name")));
    }

    /**
     * Добавить участников.
     * Body: { "memberIds": ["id1", "id2"] }
     */
    @PutMapping(value = "/{groupId}/members/add", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ChatGroup> addMembers(@PathVariable String groupId,
                                                 @RequestBody Map<String, Object> body,
                                                 @AuthenticationPrincipal CurrentUser currentUser) {
        if (currentUser == null) throw new ForbiddenException("Access denied");
        @SuppressWarnings("unchecked")
        List<String> memberList = (List<String>) body.getOrDefault("memberIds", Collections.emptyList());
        return ResponseEntity.ok(chatGroupService.addMembers(groupId, currentUser.getUserId(), new HashSet<>(memberList)));
    }

    /**
     * Удалить участника или выйти из группы.
     */
    @DeleteMapping(value = "/{groupId}/members/{userId}")
    public ResponseEntity<ChatGroup> removeMember(@PathVariable String groupId,
                                                   @PathVariable String userId,
                                                   @AuthenticationPrincipal CurrentUser currentUser) {
        if (currentUser == null) throw new ForbiddenException("Access denied");
        return ResponseEntity.ok(chatGroupService.removeMember(groupId, currentUser.getUserId(), userId));
    }

    /**
     * Удалить группу (только создатель).
     */
    @DeleteMapping(value = "/{groupId}")
    public ResponseEntity<Void> deleteGroup(@PathVariable String groupId,
                                             @AuthenticationPrincipal CurrentUser currentUser) {
        if (currentUser == null) throw new ForbiddenException("Access denied");
        chatGroupService.deleteGroup(groupId, currentUser.getUserId());
        return ResponseEntity.noContent().build();
    }

    /**
     * Сообщения группы (пагинация).
     */
    @GetMapping(value = "/{groupId}/messages", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ChatMessagesPage> getGroupMessages(@PathVariable String groupId,
                                                              @RequestParam(defaultValue = "0") int page,
                                                              @RequestParam(defaultValue = "50") int size,
                                                              @AuthenticationPrincipal CurrentUser currentUser) {
        if (currentUser == null) throw new ForbiddenException("Access denied");
        return ResponseEntity.ok(chatGroupService.getGroupMessages(groupId, currentUser.getUserId(), page, size));
    }

    /**
     * Загрузить аватарку группы (только создатель).
     */
    @PostMapping(value = "/{groupId}/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ChatGroup> uploadAvatar(@PathVariable String groupId,
                                                   @RequestParam("file") MultipartFile file,
                                                   @AuthenticationPrincipal CurrentUser currentUser) {
        if (currentUser == null) throw new ForbiddenException("Access denied");
        return ResponseEntity.ok(chatGroupService.uploadAvatar(groupId, currentUser.getUserId(), file));
    }

    /**
     * Получить presigned URL аватарки группы.
     */
    @GetMapping(value = "/{groupId}/avatar-url", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, String>> getAvatarUrl(@PathVariable String groupId,
                                                             @AuthenticationPrincipal CurrentUser currentUser) {
        if (currentUser == null) throw new ForbiddenException("Access denied");
        return chatGroupService.getAvatarUrl(groupId, currentUser.getUserId())
                .map(url -> ResponseEntity.ok(Map.of("url", url)))
                .orElse(ResponseEntity.noContent().build());
    }

    @PostMapping(value = "/{groupId}/mute", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ChatGroup> toggleMute(@PathVariable String groupId,
                                                 @AuthenticationPrincipal CurrentUser currentUser) {
        if (currentUser == null) throw new ForbiddenException("Access denied");
        return ResponseEntity.ok(chatGroupService.toggleMute(groupId, currentUser.getUserId()));
    }

    @PostMapping(value = "/{groupId}/mark-read", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Long>> markRead(@PathVariable String groupId,
                                                       @AuthenticationPrincipal CurrentUser currentUser) {
        if (currentUser == null) throw new ForbiddenException("Access denied");
        long count = chatGroupService.markGroupMessagesRead(groupId, currentUser.getUserId());
        return ResponseEntity.ok(Map.of("updated", count));
    }
}
