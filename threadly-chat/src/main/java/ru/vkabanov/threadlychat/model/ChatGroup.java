package ru.vkabanov.threadlychat.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;
import java.util.Set;

/**
 * Групповой чат.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Document(collection = "chatGroups")
public class ChatGroup {
    @Id
    private String id;

    /** Название группы */
    private String name;

    /** ID создателя (администратор) */
    private String creatorId;

    /** ID всех участников (включая создателя) */
    private Set<String> memberIds;

    /** Дата создания */
    private Date createdAt;
}
