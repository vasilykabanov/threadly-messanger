package ru.vkabanov.threadlyauth.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import ru.vkabanov.threadlyauth.model.PasswordResetToken;

import java.util.Optional;

public interface PasswordResetTokenRepository extends MongoRepository<PasswordResetToken, String> {

    Optional<PasswordResetToken> findByToken(String token);

    void deleteAllByUserId(String userId);
}
