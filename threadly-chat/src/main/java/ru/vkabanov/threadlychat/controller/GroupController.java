package ru.vkabanov.threadlychat.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
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
        return ResponseEntity.ok(chatGroupService.getUserGroups(currentUser.getUserId()));
    }

    /**
     * Получить группу по ID.
     */
    @GetMapping(value = "/{groupId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ChatGroup> getGroup(@PathVariable String groupId,
                                               @AuthenticationPrincipal CurrentUser currentUser) {
        if (currentUser == null) throw new ForbiddenException("Access denied");
        return ResponseEntity.ok(chatGroupService.getGroup(groupId, currentUser.getUserId()));
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
}
