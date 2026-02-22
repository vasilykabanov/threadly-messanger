package ru.vkabanov.threadlychat.configuration;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Data
@Configuration
@ConfigurationProperties(prefix = "threadly.image")
public class ImageValidationProperties {

    /** Максимальный размер файла в байтах (по умолчанию 10 MB). */
    private long maxSizeBytes = 10 * 1024 * 1024;

    /** Разрешённые MIME-типы (например: image/jpeg, image/png, image/webp). */
    private List<String> allowedContentTypes = List.of("image/jpeg", "image/png", "image/webp");
}
