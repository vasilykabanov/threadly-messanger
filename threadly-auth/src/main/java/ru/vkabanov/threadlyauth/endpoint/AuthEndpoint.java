package ru.vkabanov.threadlyauth.endpoint;


import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import ru.vkabanov.threadlyauth.exception.BadRequestException;
import ru.vkabanov.threadlyauth.exception.EmailAlreadyExistsException;
import ru.vkabanov.threadlyauth.exception.UsernameAlreadyExistsException;
import ru.vkabanov.threadlyauth.model.Profile;
import ru.vkabanov.threadlyauth.model.Role;
import ru.vkabanov.threadlyauth.model.User;
import ru.vkabanov.threadlyauth.payload.*;
import ru.vkabanov.threadlyauth.service.UserService;

import javax.validation.Valid;
import java.net.URI;

@RestController
@Slf4j
public class AuthEndpoint {

    @Autowired
    private UserService userService;

    @PostMapping("/signin")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {
        String token = userService.loginUser(loginRequest.getUsername(), loginRequest.getPassword());
        return ResponseEntity.ok(new JwtAuthenticationResponse(token));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody ResetPasswordRequest request) {
        try {
            String message = userService.initiatePasswordReset(request.getLoginOrEmail());
            return ResponseEntity.ok(new ApiResponse(true, message));
        } catch (BadRequestException e) {
            throw e;
        }
    }

    @GetMapping("/reset-password/validate")
    public ResponseEntity<?> validateResetToken(@RequestParam String token) {
        try {
            userService.validateResetToken(token);
            return ResponseEntity.ok(new ApiResponse(true, "Токен действителен"));
        } catch (BadRequestException e) {
            throw e;
        }
    }

    @PostMapping("/reset-password/confirm")
    public ResponseEntity<?> confirmResetPassword(@Valid @RequestBody ConfirmResetPasswordRequest request) {
        try {
            userService.confirmPasswordReset(request.getToken(), request.getNewPassword());
            return ResponseEntity.ok(new ApiResponse(true, "Пароль успешно изменён"));
        } catch (BadRequestException e) {
            throw e;
        }
    }

    @PostMapping(value = "/users", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> createUser(@Valid @RequestBody SignUpRequest payload) {
        log.info("creating user {}", payload.getUsername());

        User user = User
                .builder()
                .username(payload.getUsername())
                .email(payload.getEmail())
                .password(payload.getPassword())
                .userProfile(Profile.builder()
                        .displayName(payload.getName())
                .profilePictureUrl(payload.getProfilePicUrl() == null || payload.getProfilePicUrl().isBlank()
                    ? null
                    : payload.getProfilePicUrl())
                        .build())
                .build();

        try {
            userService.registerUser(user, Role.USER);
        } catch (UsernameAlreadyExistsException | EmailAlreadyExistsException e) {
            throw new BadRequestException(e.getMessage());
        }

        URI location = ServletUriComponentsBuilder
                .fromCurrentContextPath().path("/users/{username}")
                .buildAndExpand(user.getUsername()).toUri();

        return ResponseEntity
                .created(location)
                .body(new ApiResponse(true, "User registered successfully"));
    }
}
