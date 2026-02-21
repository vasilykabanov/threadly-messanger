package ru.vkabanov.threadlyauth.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import ru.vkabanov.threadlyauth.exception.BadRequestException;
import ru.vkabanov.threadlyauth.exception.EmailAlreadyExistsException;
import ru.vkabanov.threadlyauth.exception.ResourceNotFoundException;
import ru.vkabanov.threadlyauth.exception.UsernameAlreadyExistsException;
import ru.vkabanov.threadlyauth.model.PasswordResetToken;
import ru.vkabanov.threadlyauth.model.Profile;
import ru.vkabanov.threadlyauth.model.Role;
import ru.vkabanov.threadlyauth.model.User;
import ru.vkabanov.threadlyauth.repository.PasswordResetTokenRepository;
import ru.vkabanov.threadlyauth.repository.UserRepository;
import ru.vkabanov.threadlyauth.payload.UpdateProfileRequest;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class UserService {

    private final PasswordEncoder passwordEncoder;
    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final JwtTokenProvider tokenProvider;
    private final AuthenticationConfiguration authenticationConfiguration;
    private final EmailService emailService;

    public String loginUser(String username, String password) {
        try {
            AuthenticationManager authenticationManager = authenticationConfiguration.getAuthenticationManager();
            Authentication authentication = authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(username, password));
            return tokenProvider.generateToken(authentication);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public User registerUser(User user, Role role) {
        log.info("registering user {}", user.getUsername());

        if (userRepository.existsByUsernameIgnoreCase(user.getUsername())) {
            log.warn("username {} already exists.", user.getUsername());
            throw new UsernameAlreadyExistsException(String.format("username %s already exists", user.getUsername()));
        }

        if (userRepository.existsByEmail(user.getEmail())) {
            log.warn("email {} already exists.", user.getEmail());
            throw new EmailAlreadyExistsException(String.format("email %s already exists", user.getEmail()));
        }
        user.setActive(true);
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setRoles(new HashSet<>() {{
            add(role);
        }});

        return userRepository.save(user);
    }

    public List<User> findAll() {
        log.info("retrieving all users");
        return userRepository.findAll();
    }

    public Optional<User> findByUsername(String username) {
        log.info("retrieving user {}", username);
        return userRepository.findByUsernameIgnoreCase(username);
    }

    public Optional<User> findById(String id) {
        log.info("retrieving user {}", id);
        return userRepository.findById(id);
    }

    public User changePassword(String userId, String currentPassword, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(userId));

        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new BadRequestException("Неверный текущий пароль");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        return userRepository.save(user);
    }

    /**
     * Initiates password reset: finds user by login or email, generates token, sends email.
     * Returns a message to display to the user (with masked email or generic text).
     */
    public String initiatePasswordReset(String loginOrEmail) {
        boolean isEmail = loginOrEmail.contains("@");
        Optional<User> userOpt;

        if (isEmail) {
            userOpt = userRepository.findByEmail(loginOrEmail);
        } else {
            userOpt = userRepository.findByUsernameIgnoreCase(loginOrEmail);
        }

        User user = userOpt.orElseThrow(() ->
                new BadRequestException("Пользователь с такой почтой или с таким логином не найден"));

        // Delete old tokens for this user
        tokenRepository.deleteByUserId(user.getId());

        // Generate new token
        String token = UUID.randomUUID().toString();
        PasswordResetToken resetToken = PasswordResetToken.builder()
                .token(token)
                .userId(user.getId())
                .expiryDate(Instant.now().plus(1, ChronoUnit.HOURS))
                .build();
        tokenRepository.save(resetToken);

        // Send email
        emailService.sendPasswordResetEmail(user.getEmail(), token);

        // Return appropriate message
        if (isEmail) {
            return "Письмо отправлено на данную почту";
        } else {
            return "Письмо отправлено на почту " + maskEmail(user.getEmail());
        }
    }

    /**
     * Validates that a reset token exists and is not expired.
     */
    public void validateResetToken(String token) {
        PasswordResetToken resetToken = tokenRepository.findByToken(token)
                .orElseThrow(() -> new BadRequestException("Ссылка недействительна"));

        if (resetToken.isExpired()) {
            tokenRepository.delete(resetToken);
            throw new BadRequestException("Ссылка истекла");
        }
    }

    /**
     * Confirms password reset using a token: validates token, sets new password, deletes token.
     */
    public void confirmPasswordReset(String token, String newPassword) {
        PasswordResetToken resetToken = tokenRepository.findByToken(token)
                .orElseThrow(() -> new BadRequestException("Ссылка недействительна"));

        if (resetToken.isExpired()) {
            tokenRepository.delete(resetToken);
            throw new BadRequestException("Ссылка истекла");
        }

        User user = userRepository.findById(resetToken.getUserId())
                .orElseThrow(() -> new BadRequestException("Пользователь не найден"));

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        tokenRepository.delete(resetToken);
        log.info("Password reset confirmed for user {}", user.getUsername());
    }

    /**
     * Masks an email: "vladik@gmail.com" → "vl***k@gmail.com"
     */
    private String maskEmail(String email) {
        int atIdx = email.indexOf('@');
        if (atIdx <= 2) {
            return "**" + email.substring(atIdx);
        }
        String local = email.substring(0, atIdx);
        String domain = email.substring(atIdx);
        return local.substring(0, 2)
                + "*".repeat(Math.max(1, local.length() - 3))
                + local.charAt(local.length() - 1)
                + domain;
    }

    public User updateProfile(String userId, UpdateProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(userId));

        String newUsername = request.getUsername();
        if (!user.getUsername().equalsIgnoreCase(newUsername)) {
            userRepository.findByUsernameIgnoreCase(newUsername).ifPresent(existing -> {
                if (!existing.getId().equals(user.getId())) {
                    throw new UsernameAlreadyExistsException(
                            String.format("username %s already exists", newUsername));
                }
            });
        }

        String newEmail = request.getEmail();
        if (!user.getEmail().equalsIgnoreCase(newEmail)) {
            userRepository.findByEmail(newEmail).ifPresent(existing -> {
                if (!existing.getId().equals(user.getId())) {
                    throw new EmailAlreadyExistsException(
                            String.format("email %s already exists", newEmail));
                }
            });
        }

        user.setUsername(newUsername);
        user.setEmail(newEmail);

        Profile profile = user.getUserProfile();
        if (profile == null) {
            profile = new Profile();
        }
        profile.setDisplayName(request.getName());
        profile.setProfilePictureUrl(request.getProfilePictureUrl());
        user.setUserProfile(profile);

        return userRepository.save(user);
    }
}
