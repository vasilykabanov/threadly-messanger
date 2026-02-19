package ru.vkabanov.threadlyauth.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;


@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document
public class User {

    public User(User user) {
        this.id = user.id;
        this.username = user.username;
        this.password = user.password;
        this.email = user.email;
        this.createdAt = user.getCreatedAt();
        this.updatedAt = user.getUpdatedAt();
        this.active = user.active;
        this.userProfile = user.userProfile;
        this.roles = user.roles;
        this.emailVerified = user.emailVerified;
        this.emailVerificationToken = user.emailVerificationToken;
        this.lastVerificationEmailSentAt = user.lastVerificationEmailSentAt;
        this.verificationResendCount = user.verificationResendCount;
        this.verificationResendPeriodStart = user.verificationResendPeriodStart;
        this.registrationStatus = user.registrationStatus;
        this.blocked = user.blocked;
        this.registrationDate = user.registrationDate;
    }

    public User(String username, String password, String email) {
        this.username = username;
        this.password = password;
        this.email = email;
        this.active = true;
        this.roles = new HashSet<>() {{ new Role("USER"); }};
    }

    @Id
    private String id;

    @NotBlank
    @Size(max = 15)
    private String username;

    @NotBlank
    @Size(max = 100)
    @JsonIgnore
    private String password;

    @NotBlank
    @Size(max = 40)
    @Email
    private String email;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    private boolean active;
    private Profile userProfile;
    private Set<Role> roles;
    private boolean emailVerified;
    private String emailVerificationToken;

    /** Время последней отправки письма подтверждения (для лимита повторов) */
    private Instant lastVerificationEmailSentAt;
    /** Количество повторных отправок в текущем 24-часовом окне */
    private Integer verificationResendCount;
    /** Начало 24-часового окна для подсчёта повторов */
    private Instant verificationResendPeriodStart;

    private RegistrationStatus registrationStatus;
    private boolean blocked;
    private LocalDateTime registrationDate;
}
