package ru.vkabanov.threadlyauth.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import ru.vkabanov.threadlyauth.exception.BadRequestException;
import ru.vkabanov.threadlyauth.model.RegistrationApprovalToken;
import ru.vkabanov.threadlyauth.model.RegistrationStatus;
import ru.vkabanov.threadlyauth.model.User;
import ru.vkabanov.threadlyauth.repository.RegistrationApprovalTokenRepository;
import ru.vkabanov.threadlyauth.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class RegistrationApprovalService {

    private static final int TOKEN_EXPIRY_HOURS = 24;

    private final RegistrationApprovalTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;

    public void createApprovalRequest(User user) {
        RegistrationApprovalToken token = RegistrationApprovalToken.builder()
                .token(UUID.randomUUID().toString())
                .user(user)
                .expiryDate(LocalDateTime.now().plusHours(TOKEN_EXPIRY_HOURS))
                .used(false)
                .build();
        RegistrationApprovalToken savedToken = tokenRepository.save(token);
        emailService.sendAdminRegistrationApprovalEmail(user, savedToken.getToken());
        log.info("Registration approval token created for user {} with id {}", user.getUsername(), savedToken.getId());
    }

    public void approveRegistration(String tokenValue) {
        RegistrationApprovalToken token = getValidToken(tokenValue);
        User user = token.getUser();

        if (user == null) {
            throw new BadRequestException("Пользователь для данного токена не найден");
        }

        user.setRegistrationStatus(RegistrationStatus.APPROVED);
        user.setBlocked(false);
        user.setActive(true);
        token.setUsed(true);
        userRepository.save(user);
        tokenRepository.save(token);
        emailService.sendUserRegistrationApprovedEmail(user);
        log.info("Registration approved for user {} via token {}", user.getUsername(), tokenValue);
    }

    public void rejectRegistration(String tokenValue) {
        RegistrationApprovalToken token = getValidToken(tokenValue);
        User user = token.getUser();

        if (user == null) {
            throw new BadRequestException("Пользователь для данного токена не найден");
        }

        user.setRegistrationStatus(RegistrationStatus.REJECTED);
        user.setBlocked(true);
        user.setActive(false);
        token.setUsed(true);
        userRepository.save(user);
        tokenRepository.save(token);
        emailService.sendUserRegistrationRejectedEmail(user);
        log.info("Registration rejected for user {} via token {}", user.getUsername(), tokenValue);
    }

    private RegistrationApprovalToken getValidToken(String tokenValue) {
        RegistrationApprovalToken token = tokenRepository.findByToken(tokenValue)
                .orElseThrow(() -> new BadRequestException("Токен подтверждения регистрации не найден"));

        if (token.isUsed()) {
            throw new BadRequestException("Токен уже использован");
        }

        if (token.getExpiryDate() != null && token.getExpiryDate().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Срок действия токена истёк");
        }

        return token;
    }
}
