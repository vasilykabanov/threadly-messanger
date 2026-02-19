package ru.vkabanov.threadlyauth.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.Collections;
import java.util.List;

@Data
@Configuration
@ConfigurationProperties(prefix = "app.registration")
public class RegistrationProperties {

    private List<String> admins = Collections.emptyList();

    private String adminApprovalBaseUrl;
}
