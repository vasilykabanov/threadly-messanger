package ru.vkabanov.threadlyauth.endpoint;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
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
import ru.vkabanov.threadlyauth.service.UserService;

import javax.validation.Valid;


@RestController
@Slf4j
public class UserEndpoint {

    @Autowired
    private UserService userService;

    @GetMapping(value = "/users/{username}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> findUser(@PathVariable("username") String username) {
        log.info("retrieving user {}", username);

        return userService.findByUsername(username)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new ResourceNotFoundException(username));
    }

    @GetMapping(value = "/users", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> findAll() {
        log.info("retrieving all users");
        return ResponseEntity.ok(userService.findAll());
    }

    @GetMapping(value = "/users/summaries", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> findAllUserSummaries(@AuthenticationPrincipal ThreadlyUserDetails userDetails,
                                                  @RequestHeader(value = "Authorization", required = false) String authorization) {
        log.info("retrieving user summaries (only with conversation)");

        return ResponseEntity.ok(userService
                .findUsersWithConversation(userDetails.getId(), authorization)
                .stream()
                .filter(user -> !user.getUsername().equals(userDetails.getUsername()))
                .map(this::convertTo));
    }

    @GetMapping(value = "/users/search", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> searchUsers(@RequestParam("q") String query,
                                         @AuthenticationPrincipal ThreadlyUserDetails userDetails) {
        return ResponseEntity.ok(userService
                .searchUsers(query, userDetails.getId())
                .stream()
                .map(this::convertTo));
    }

    @GetMapping(value = "/users/me", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasRole('USER')")
    @ResponseStatus(HttpStatus.OK)
    public UserSummary getCurrentUser(@AuthenticationPrincipal ThreadlyUserDetails userDetails) {
        String displayName = userDetails.getUserProfile() != null
                ? userDetails.getUserProfile().getDisplayName()
                : null;
        String profilePicture = userDetails.getUserProfile() != null
                ? userDetails.getUserProfile().getProfilePictureUrl()
                : null;

        return UserSummary
                .builder()
                .id(userDetails.getId())
                .username(userDetails.getUsername())
                .name(displayName)
                .email(userDetails.getEmail())
                .profilePicture(profilePicture)
                .build();
    }

    @PutMapping(value = "/users/me", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<UserSummary> updateProfile(
            @AuthenticationPrincipal ThreadlyUserDetails userDetails,
            @Valid @RequestBody UpdateProfileRequest request) {
        try {
            User updatedUser = userService.updateProfile(userDetails.getId(), request);
            return ResponseEntity.ok(convertTo(updatedUser));
        } catch (UsernameAlreadyExistsException | EmailAlreadyExistsException e) {
            throw new BadRequestException(e.getMessage());
        }
    }

    @PutMapping(value = "/users/me/password", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<ApiResponse> changePassword(
            @AuthenticationPrincipal ThreadlyUserDetails userDetails,
            @Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(userDetails.getId(), request.getCurrentPassword(), request.getNewPassword());
        return ResponseEntity.ok(new ApiResponse(true, "Пароль изменён"));
    }

    @GetMapping(value = "/users/summary/{username}", produces = MediaType.APPLICATION_JSON_VALUE)
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
        String profilePicture = user.getUserProfile() != null
                ? user.getUserProfile().getProfilePictureUrl()
                : null;
        return UserSummary
                .builder()
                .id(user.getId())
                .username(user.getUsername())
                .name(displayName)
                .email(user.getEmail())
                .profilePicture(profilePicture)
                .build();
    }
}