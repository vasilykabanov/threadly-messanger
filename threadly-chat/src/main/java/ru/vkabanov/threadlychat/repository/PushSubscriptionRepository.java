package ru.vkabanov.threadlychat.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import ru.vkabanov.threadlychat.model.PushSubscription;

import java.util.List;
import java.util.Optional;

public interface PushSubscriptionRepository extends MongoRepository<PushSubscription, String> {
    Optional<PushSubscription> findByEndpoint(String endpoint);

    List<PushSubscription> findAllByUserId(String userId);

    void deleteByEndpoint(String endpoint);
}
