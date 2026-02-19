package ru.vkabanov.threadlyauth.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import ru.vkabanov.threadlyauth.model.RegistrationApprovalToken;

import java.util.Optional;

public interface RegistrationApprovalTokenRepository extends MongoRepository<RegistrationApprovalToken, String> {
    Optional<RegistrationApprovalToken> findByToken(String token);
}
