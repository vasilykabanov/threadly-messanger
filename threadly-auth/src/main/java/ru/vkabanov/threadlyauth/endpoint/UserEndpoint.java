package ru.vkabanov.threadlyauth.endpoint;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import ru.vkabanov.threadlyauth.exception.BadRequestException;
import ru.vkabanov.threadlyauth.exception.EmailAlreadyExistsException;
import ru.vkabanov.threadlyauth.exception.ResourceNotFoundException;
import ru.vkabanov.threadlyauth.exception.UsernameAlreadyExistsException;
import ru.vkabanov.threadlyauth.model.ThreadlyUserDetails;
import ru.vkabanov.threadlyauth.model.User;
import ru.vkabanov.threadlyauth.payload.ApiResponse;
import ru.vkabanov.threadlyauth.payload.ChangePasswordRequest;
import ru.vkabanov.threadlyauth.payload.UpdateProfileRequest;
import ru.vkabanov.threadlyauth.payload.UserSummary;
import ru.vkabanov.threadlyauth.service.AvatarStorageService;
import ru.vkabanov.threadlyauth.service.UserService;

import javax.validation.Valid;
import java.io.InputStream;
import java.time.Instant;

import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;


@RestController
@Slf4j
public class UserEndpoint {

    @Autowired
    private UserService userService;
    @Autowired
    private AvatarStorageService avatarStorageService;

    @GetMapping(value = "/users/{username}", produces = APPLICATION_JSON_VALUE)
    public ResponseEntity<?> findUser(@PathVariable("username") String username) {
        log.info("retrieving user {}", username);

        return userService.findByUsername(username)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new ResourceNotFoundException(username));
    }

    @GetMapping(value = "/users", produces = APPLICATION_JSON_VALUE)
    public ResponseEntity<?> findAll() {
        log.info("retrieving all users");
        return ResponseEntity.ok(userService.findAll());
    }

    @GetMapping(value = "/users/summaries", produces = APPLICATION_JSON_VALUE)
    public ResponseEntity<?> findAllUserSummaries(@AuthenticationPrincipal ThreadlyUserDetails userDetails,
                                                  @RequestHeader(value = "Authorization", required = false) String authorization) {
        log.info("retrieving user summaries (only with conversation)");

        return ResponseEntity.ok(userService
                .findUsersWithConversation(userDetails.getId(), authorization)
                .stream()
                .filter(user -> !user.getUsername().equals(userDetails.getUsername()))
                .map(this::convertTo));
    }

    @GetMapping(value = "/users/search", produces = APPLICATION_JSON_VALUE)
    public ResponseEntity<?> searchUsers(@RequestParam("q") String query,
                                         @AuthenticationPrincipal ThreadlyUserDetails userDetails) {
        return ResponseEntity.ok(userService
                .searchUsers(query, userDetails.getId())
                .stream()
                .map(this::convertTo));
    }

    @GetMapping(value = "/users/me", produces = APPLICATION_JSON_VALUE)
    @PreAuthorize("hasRole('USER')")
    @ResponseStatus(HttpStatus.OK)
    public UserSummary getCurrentUser(@AuthenticationPrincipal ThreadlyUserDetails userDetails) {
        String displayName = userDetails.getUserProfile() != null
                ? userDetails.getUserProfile().getDisplayName()
                : null;
        String profilePictureKey = userDetails.getUserProfile() != null
                ? userDetails.getUserProfile().getProfilePictureUrl()
                : null;
        String profilePicture = profilePictureKey != null && !profilePictureKey.isBlank()
                ? buildAvatarUrl(userDetails.getId(), userDetails.getUpdatedAt())
                : null;

        return UserSummary.builder()
                .id(userDetails.getId())
                .username(userDetails.getUsername())
                .name(displayName)
                .email(userDetails.getEmail())
                .profilePicture(profilePicture)
                .build();
    }

    /**
     * Загрузка/обновление аватара текущего пользователя.
     */
    @PostMapping(value = "/users/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = APPLICATION_JSON_VALUE)
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<UserSummary> uploadAvatar(@AuthenticationPrincipal ThreadlyUserDetails userDetails,
                                                    @RequestPart("file") MultipartFile file) {
        User updated = userService.updateAvatar(userDetails.getId(), file);
        return ResponseEntity.ok(convertTo(updated));
    }

    /**
     * Прокси-эндпойнт для аватара пользователя (same-origin, обход ORB).
     */
    @GetMapping(value = "/users/{userId}/avatar")
    public ResponseEntity<StreamingResponseBody> getAvatar(@PathVariable String userId) {
        return userService.findById(userId)
                .flatMap(user -> {
                    if (user.getUserProfile() == null || user.getUserProfile().getProfilePictureUrl() == null) {
                        return java.util.Optional.<ResponseEntity<StreamingResponseBody>>empty();
                    }
                    String objectKey = user.getUserProfile().getProfilePictureUrl();
                    return avatarStorageService.getObjectStream(objectKey)
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
                            });
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping(value = "/users/me", produces = APPLICATION_JSON_VALUE)
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<UserSummary> updateProfile(@AuthenticationPrincipal ThreadlyUserDetails userDetails,
                                                     @Valid @RequestBody UpdateProfileRequest request) {
        try {
            User updatedUser = userService.updateProfile(userDetails.getId(), request);
            return ResponseEntity.ok(convertTo(updatedUser));
        } catch (UsernameAlreadyExistsException | EmailAlreadyExistsException e) {
            throw new BadRequestException(e.getMessage());
        }
    }

    @PutMapping(value = "/users/me/password", produces = APPLICATION_JSON_VALUE)
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<ApiResponse> changePassword(@AuthenticationPrincipal ThreadlyUserDetails userDetails,
                                                      @Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(userDetails.getId(), request.getCurrentPassword(), request.getNewPassword());
        return ResponseEntity.ok(new ApiResponse(true, "Пароль изменён"));
    }

    @GetMapping(value = "/users/summary/{username}", produces = APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getUserSummary(@PathVariable("username") String username) {
        log.info("retrieving user {}", username);
        return userService.findByUsername(username)
                .map(user -> ResponseEntity.ok(convertTo(user)))
                .orElseThrow(() -> new ResourceNotFoundException(username));
    }

    private UserSummary convertTo(User user) {
        String displayName = user.getUserProfile() != null
                ? user.getUserProfile().getDisplayName()
                : null;
        String profilePictureKey = user.getUserProfile() != null
                ? user.getUserProfile().getProfilePictureUrl()
                : null;
        String profilePicture = profilePictureKey != null && !profilePictureKey.isBlank()
                ? buildAvatarUrl(user.getId(), user.getUpdatedAt())
                : null;

        return UserSummary.builder()
                .id(user.getId())
                .username(user.getUsername())
                .name(displayName)
                .email(user.getEmail())
                .profilePicture(profilePicture)
                .build();
    }

    private String buildAvatarUrl(String userId, Instant updatedAt) {
        String basePath = "/api/auth/users/" + userId + "/avatar";
        if (updatedAt == null) {
            return basePath;
        }
        String separator = basePath.contains("?") ? "&" : "?";
        return basePath + separator + "v=" + updatedAt.toEpochMilli();
    }
}