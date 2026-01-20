package ru.vkabanov.threadlyauth.repository;


import org.springframework.data.mongodb.repository.MongoRepository;
import ru.vkabanov.threadlyauth.model.User;

import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {

    Optional<User> findByUsername(String username);
    Boolean existsByUsername(String username);
    Boolean existsByEmail(String email);
}
