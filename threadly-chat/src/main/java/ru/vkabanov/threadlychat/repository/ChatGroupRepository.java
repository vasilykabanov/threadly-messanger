package ru.vkabanov.threadlychat.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import ru.vkabanov.threadlychat.model.ChatGroup;

import java.util.List;

public interface ChatGroupRepository extends MongoRepository<ChatGroup, String> {

    /** Найти все группы, в которых пользователь является участником */
    List<ChatGroup> findByMemberIdsContaining(String userId);
}
