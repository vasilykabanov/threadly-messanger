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
import ru.vkabanov.threadlyauth.model.Role;
import ru.vkabanov.threadlyauth.model.User;
import ru.vkabanov.threadlyauth.repository.UserRepository;
import ru.vkabanov.threadlyauth.payload.UpdateProfileRequest;

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
    private final JwtTokenProvider tokenProvider;
    private final AuthenticationConfiguration authenticationConfiguration;
    private final EmailService emailService;

    public String loginUser(String username, String password) {
        try {
            // Check if email is verified before allowing login
            User user = userRepository.findByUsernameIgnoreCase(username)
                    .orElseThrow(() -> new BadRequestException("Неверный логин или пароль"));
            
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

        // Email verification
        user.setEmailVerified(false);
        user.setEmailVerificationToken(UUID.randomUUID().toString());

        User savedUser = userRepository.save(user);
        
        // Send verification email asynchronously
        emailService.sendVerificationEmail(savedUser);
        
        return savedUser;
    }
    
    public User verifyEmail(String token) {
        User user = userRepository.findByEmailVerificationToken(token)
                .orElseThrow(() -> new BadRequestException("Недействительный токен подтверждения"));
        
        if (user.isEmailVerified()) {
            throw new BadRequestException("Email уже подтверждён");
        }
        
        user.setEmailVerified(true);
        user.setEmailVerificationToken(null);
        
        log.info("Email verified for user {}", user.getUsername());
        return userRepository.save(user);
    }
    
    public void resendVerificationEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Пользователь не найден"));
        
        if (user.isEmailVerified()) {
            throw new BadRequestException("Email уже подтверждён");
        }
        
        user.setEmailVerificationToken(UUID.randomUUID().toString());
        userRepository.save(user);
        
        emailService.sendVerificationEmail(user);
        log.info("Verification email resent to {}", email);
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
