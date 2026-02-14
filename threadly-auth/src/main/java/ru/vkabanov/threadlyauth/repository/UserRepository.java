package ru.vkabanov.threadlyauth.repository;


import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import ru.vkabanov.threadlyauth.model.User;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {

    Optional<User> findByUsername(String username);
    Optional<User> findByUsernameIgnoreCase(String username);
    Optional<User> findByEmail(String email);
    Optional<User> findByEmailVerificationToken(String token);
    Boolean existsByUsername(String username);
    Boolean existsByUsernameIgnoreCase(String username);
    Boolean existsByEmail(String email);

    /** Поиск по username или displayName (для начала чата), лимит через Pageable. */
    @Query("{ $or: [ { 'username': { $regex: ?0, $options: 'i' } }, { 'userProfile.displayName': { $regex: ?0, $options: 'i' } } ] }")
    List<User> searchByUsernameOrDisplayName(String query, Pageable pageable);
}
