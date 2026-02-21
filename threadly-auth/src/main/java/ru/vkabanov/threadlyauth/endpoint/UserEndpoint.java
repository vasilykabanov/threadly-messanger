package ru.vkabanov.threadlyauth.endpoint;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import ru.vkabanov.threadlyauth.exception.BadRequestException;
import ru.vkabanov.threadlyauth.service.FileStorageService;

import java.net.MalformedURLException;
import java.nio.file.Path;
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

    @Autowired
    private FileStorageService fileStorageService;

    @PostMapping("/users/me/avatar")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> uploadAvatar(
            @AuthenticationPrincipal ThreadlyUserDetails userDetails,
            @RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            throw new BadRequestException("Файл не выбран");
        }
        long maxSize = 5 * 1024 * 1024; // 5MB
        if (file.getSize() > maxSize) {
            throw new BadRequestException("Файл слишком большой (макс. 5MB)");
        }
        String filename = fileStorageService.storeFile(file);
        String avatarUrl = "/avatars/" + filename;

        // Update user profile with new avatar URL
        UpdateProfileRequest updateRequest = new UpdateProfileRequest();
        User user = userService.findById(userDetails.getId())
                .orElseThrow(() -> new ResourceNotFoundException(userDetails.getId()));
        updateRequest.setName(user.getUserProfile() != null ? user.getUserProfile().getDisplayName() : userDetails.getUsername());
        updateRequest.setUsername(user.getUsername());
        updateRequest.setEmail(user.getEmail());
        updateRequest.setProfilePictureUrl(avatarUrl);
        User updatedUser = userService.updateProfile(userDetails.getId(), updateRequest);

        return ResponseEntity.ok(convertTo(updatedUser));
    }

    @GetMapping("/avatars/{filename:.+}")
    public ResponseEntity<Resource> getAvatar(@PathVariable String filename) {
        try {
            Path filePath = fileStorageService.getFilePath(filename);
            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                return ResponseEntity.notFound().build();
            }
            String contentType = "image/jpeg";
            String lower = filename.toLowerCase();
            if (lower.endsWith(".png")) contentType = "image/png";
            else if (lower.endsWith(".gif")) contentType = "image/gif";
            else if (lower.endsWith(".webp")) contentType = "image/webp";

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CACHE_CONTROL, "public, max-age=31536000")
                    .body(resource);
        } catch (MalformedURLException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping(value = "/users/{username}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> findUser(@PathVariable("username") String username) {
        log.info("retrieving user {}", username);

        return  userService
                .findByUsername(username)
                .map(user -> ResponseEntity.ok(user))
                .orElseThrow(() -> new ResourceNotFoundException(username));
    }

    @GetMapping(value = "/users", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> findAll() {
        log.info("retrieving all users");

        return ResponseEntity
                .ok(userService.findAll());
    }

    @GetMapping(value = "/users/summaries", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> findAllUserSummaries(
            @AuthenticationPrincipal ThreadlyUserDetails userDetails) {
        log.info("retrieving all users summaries");

        return ResponseEntity.ok(userService
                .findAll()
                .stream()
                .filter(user -> !user.getUsername().equals(userDetails.getUsername()))
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

        return  userService
                .findByUsername(username)
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