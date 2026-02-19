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
import ru.vkabanov.threadlyauth.model.Profile;
import ru.vkabanov.threadlyauth.model.RegistrationStatus;
import ru.vkabanov.threadlyauth.model.Role;
import ru.vkabanov.threadlyauth.model.User;
import ru.vkabanov.threadlyauth.client.ChatContactsClient;
import ru.vkabanov.threadlyauth.repository.UserRepository;
import ru.vkabanov.threadlyauth.payload.UpdateEmailBeforeVerificationRequest;
import ru.vkabanov.threadlyauth.payload.UpdateProfileRequest;

import org.springframework.data.domain.PageRequest;

import java.time.Duration;
import java.util.ArrayList;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@Service
@Slf4j
@RequiredArgsConstructor
public class UserService {

    private final PasswordEncoder passwordEncoder;
    private final UserRepository userRepository;
    private final JwtTokenProvider tokenProvider;
    private final AuthenticationConfiguration authenticationConfiguration;
    private final EmailService emailService;
    private final RegistrationApprovalService registrationApprovalService;
    private final ChatContactsClient chatContactsClient;

    private static final int SEARCH_MAX_RESULTS = 20;

    public String loginUser(String username, String password) {
        try {
            // Check if email is verified before allowing login
            User user = userRepository.findByUsernameIgnoreCase(username)
                    .orElseThrow(() -> new BadRequestException("Неверный логин или пароль"));

            RegistrationStatus status = user.getRegistrationStatus();
            if (status == RegistrationStatus.PENDING) {
                throw new BadRequestException("Ваша регистрация ожидает подтверждения");
            }
            if (status == RegistrationStatus.REJECTED || user.isBlocked()) {
                throw new BadRequestException("Доступ запрещён");
            }
            
            if (!user.isEmailVerified()) {
                throw new BadRequestException("Email не подтверждён. Проверьте почту для активации аккаунта.");
            }
            
            AuthenticationManager authenticationManager = authenticationConfiguration.getAuthenticationManager();
            Authentication authentication = authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(username, password));
            return tokenProvider.generateToken(authentication);
        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    /**
     * Обновление email до верификации.
     * Пользователь вводит username, пароль и новый email.
     * Если email ещё не подтверждён, обновляем и отправляем новое письмо.
     */
    public void updateEmailBeforeVerification(UpdateEmailBeforeVerificationRequest request) {
        String username = request.getUsername();
        String password = request.getPassword();
        String newEmail = request.getNewEmail();

        try {
            AuthenticationManager authenticationManager = authenticationConfiguration.getAuthenticationManager();
            authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(username, password));
        } catch (Exception e) {
            throw new BadRequestException("Неверный логин или пароль");
        }

        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new ResourceNotFoundException("Пользователь не найден"));

        if (user.isEmailVerified()) {
            throw new BadRequestException("Email уже подтверждён. Изменить email можно в настройках профиля.");
        }

        if (user.getEmail().equalsIgnoreCase(newEmail)) {
            throw new BadRequestException("Новый email совпадает с текущим");
        }

        userRepository.findByEmail(newEmail).ifPresent(existing -> {
            if (!existing.getId().equals(user.getId())) {
                throw new EmailAlreadyExistsException(
                        String.format("email %s уже используется", newEmail));
            }
        });

        user.setEmail(newEmail);
        user.setEmailVerified(false);
        user.setEmailVerificationToken(UUID.randomUUID().toString());

        checkAndUpdateVerificationEmailLimit(user);
        User saved = userRepository.save(user);
        emailService.sendVerificationEmail(saved);
        log.info("Email before verification updated for user {}, new email {}", username, newEmail);
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

        user.setActive(false);
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setRoles(new HashSet<>() {{
            add(role);
        }});

        user.setEmailVerified(false);
        user.setEmailVerificationToken(UUID.randomUUID().toString());
        user.setRegistrationStatus(RegistrationStatus.PENDING);
        user.setBlocked(false);
        user.setRegistrationDate(Instant.now().atZone(java.time.ZoneId.systemDefault()).toLocalDateTime());
        Instant now = Instant.now();
        user.setLastVerificationEmailSentAt(now);
        user.setVerificationResendPeriodStart(now);
        user.setVerificationResendCount(1);

        User savedUser = userRepository.save(user);

        emailService.sendVerificationEmail(savedUser);
        registrationApprovalService.createApprovalRequest(savedUser);

        return savedUser;
    }
    
    public User verifyEmail(String token) {
        User user = userRepository.findByEmailVerificationToken(token != null ? token.trim() : null)
                .orElseThrow(() -> new BadRequestException("Недействительный токен подтверждения"));
        
        if (user.isEmailVerified()) {
            throw new BadRequestException("Email уже подтверждён");
        }
        
        user.setEmailVerified(true);
        user.setEmailVerificationToken(null);
        
        log.info("Email verified for user {}", user.getUsername());
        return userRepository.save(user);
    }
    
    private static final int MIN_RESEND_INTERVAL_MINUTES = 2;
    private static final int MAX_RESENDS_PER_24H = 5;
    private static final int RESEND_WINDOW_HOURS = 24;

    /**
     * Проверяет лимиты отправки писем подтверждения и обновляет счётчики на пользователе.
     * @throws BadRequestException если превышен лимит или нужно подождать
     */
    private void checkAndUpdateVerificationEmailLimit(User user) {
        Instant now = Instant.now();

        if (user.getLastVerificationEmailSentAt() != null) {
            Duration sinceLast = Duration.between(user.getLastVerificationEmailSentAt(), now);
            if (sinceLast.toMinutes() < MIN_RESEND_INTERVAL_MINUTES) {
                long waitMin = MIN_RESEND_INTERVAL_MINUTES - sinceLast.toMinutes();
                throw new BadRequestException(
                        "Подождите " + waitMin + " мин. перед повторной отправкой.");
            }
        }

        Instant periodStart = user.getVerificationResendPeriodStart();
        int count = user.getVerificationResendCount() != null ? user.getVerificationResendCount() : 0;
        if (periodStart != null && Duration.between(periodStart, now).toHours() >= RESEND_WINDOW_HOURS) {
            periodStart = now;
            count = 0;
        }
        if (periodStart == null) {
            periodStart = now;
            count = 0;
        }
        if (count >= MAX_RESENDS_PER_24H) {
            throw new BadRequestException(
                    "Превышен лимит отправки писем. Попробуйте завтра.");
        }

        user.setLastVerificationEmailSentAt(now);
        user.setVerificationResendPeriodStart(periodStart);
        user.setVerificationResendCount(count + 1);
    }

    public void resendVerificationEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Пользователь не найден"));

        if (user.isEmailVerified()) {
            throw new BadRequestException("Email уже подтверждён");
        }

        checkAndUpdateVerificationEmailLimit(user);
        user.setEmailVerificationToken(UUID.randomUUID().toString());
        userRepository.save(user);

        emailService.sendVerificationEmail(user);
        log.info("Verification email resent to {}", email);
    }

    public List<User> findAll() {
        log.info("retrieving all users");
        return userRepository.findAll();
    }

    /**
     * Возвращает пользователей, с которыми у currentUserId есть переписка (для /users/summaries).
     * authorization — заголовок Authorization для вызова chat (JWT клиента).
     */
    public List<User> findUsersWithConversation(String currentUserId, String authorization) {
        List<String> contactIds = chatContactsClient.getContactIds(currentUserId, authorization);
        if (contactIds == null || contactIds.isEmpty()) {
            return new ArrayList<>();
        }
        return StreamSupport.stream(userRepository.findAllById(contactIds).spliterator(), false)
                .collect(Collectors.toList());
    }

    /**
     * Поиск пользователей по username или displayName (для поиска контакта / начала чата).
     */
    public List<User> searchUsers(String query, String excludeUserId) {
        if (query == null || query.trim().isEmpty()) {
            return new ArrayList<>();
        }
        String sanitized = query.trim();
        if (sanitized.length() > 50) {
            sanitized = sanitized.substring(0, 50);
        }
        String regex = ".*" + sanitized.replaceAll("([\\\\*+?^$\\[\\](){}.|])", "\\\\$1") + ".*";
        return userRepository.searchByUsernameOrDisplayName(regex, PageRequest.of(0, SEARCH_MAX_RESULTS))
                .stream()
                .filter(user -> !user.getId().equals(excludeUserId))
                .collect(Collectors.toList());
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
        boolean emailChanged = !user.getEmail().equalsIgnoreCase(newEmail);
        if (emailChanged) {
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

        if (emailChanged) {
            user.setEmailVerified(false);
            user.setEmailVerificationToken(UUID.randomUUID().toString());
        }

        User saved = userRepository.save(user);

        if (emailChanged) {
            emailService.sendVerificationEmail(saved);
        }

        return saved;
    }
}
