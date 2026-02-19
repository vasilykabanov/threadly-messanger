package ru.vkabanov.threadlyauth.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "registrationApprovalTokens")
public class RegistrationApprovalToken {

    @Id
    private String id;
    private String token;
    @DBRef
    private User user;
    private LocalDateTime expiryDate;
    private boolean used;
}
