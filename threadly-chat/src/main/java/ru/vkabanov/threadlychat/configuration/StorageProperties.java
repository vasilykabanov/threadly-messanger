package ru.vkabanov.threadlychat.configuration;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "threadly.storage")
public class StorageProperties {

    private boolean enabled;
    private String endpoint;
    private String presignedEndpoint;
    private String bucket;
    private String accessKey;
    private String secretKey;
    private String region;
    private int presignedExpirySeconds;
}
