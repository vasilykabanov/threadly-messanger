package ru.vkabanov.threadlychat.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import ru.vkabanov.threadlychat.model.PushSubscriptionEntity;

import java.util.List;

public interface PushSubscriptionRepository extends MongoRepository<PushSubscriptionEntity, String> {
    List<PushSubscriptionEntity> findByUserId(String userId);
    void deleteByUserIdAndEndpoint(String userId, String endpoint);
}

