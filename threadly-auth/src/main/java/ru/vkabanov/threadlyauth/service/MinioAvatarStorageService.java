package ru.vkabanov.threadlyauth.service;

import io.minio.GetObjectArgs;
import io.minio.GetObjectResponse;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import ru.vkabanov.threadlyauth.config.StorageProperties;

import javax.annotation.PostConstruct;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "threadly.storage.enabled", havingValue = "true")
public class MinioAvatarStorageService implements AvatarStorageService {

    private final StorageProperties properties;

    private MinioClient minioClient;

    @PostConstruct
    public void init() {
        try {
            minioClient = MinioClient.builder()
                    .endpoint(properties.getEndpoint())
                    .credentials(properties.getAccessKey(), properties.getSecretKey())
                    .build();
        } catch (Exception e) {
            log.error("Failed to initialize MinIO client for avatars: {}", e.getMessage());
            throw new IllegalStateException("Avatar storage initialization failed", e);
        }
    }

    @Override
    public String upload(java.io.InputStream inputStream, long size, String contentType, String objectKey) {
        try {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(properties.getBucket())
                    .object(objectKey)
                    .stream(inputStream, size, -1)
                    .contentType(contentType != null ? contentType : "application/octet-stream")
                    .build());
            return objectKey;
        } catch (Exception e) {
            log.error("Avatar upload failed for key {}: {}", objectKey, e.getMessage());
            throw new RuntimeException("Failed to upload avatar", e);
        }
    }

    @Override
    public Optional<AvatarStreamResult> getObjectStream(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return Optional.empty();
        }
        try {
            GetObjectResponse response = minioClient.getObject(GetObjectArgs.builder()
                    .bucket(properties.getBucket())
                    .object(objectKey)
                    .build());
            String contentType = response.headers().get("Content-Type");
            if (contentType == null || contentType.isBlank()) {
                contentType = "application/octet-stream";
            }
            return Optional.of(new AvatarStreamResult(response, contentType));
        } catch (Exception e) {
            log.warn("Failed to get avatar stream for {}: {}", objectKey, e.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public Optional<String> getPresignedUrl(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return Optional.empty();
        }
        try {
            String url = minioClient.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
                    .method(Method.GET)
                    .bucket(properties.getBucket())
                    .object(objectKey)
                    .expiry(properties.getPresignedExpirySeconds(), TimeUnit.SECONDS)
                    .build());

            if (properties.getPresignedEndpoint() != null && !properties.getPresignedEndpoint().isBlank()) {
                String internal = properties.getEndpoint().replaceFirst("^https?://", "").replaceFirst("/$", "");
                String replacement = properties.getPresignedEndpoint().replaceFirst("/$", "");
                url = url.replaceFirst("(?i)^https?://" + Pattern.quote(internal), replacement);
            }
            return Optional.of(url);
        } catch (Exception e) {
            log.warn("Failed to get presigned URL for avatar {}: {}", objectKey, e.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public void delete(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return;
        }
        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(properties.getBucket())
                    .object(objectKey)
                    .build());
        } catch (Exception e) {
            log.warn("Failed to delete avatar {}: {}", objectKey, e.getMessage());
        }
    }

    @Override
    public boolean isEnabled() {
        return properties.isEnabled() && minioClient != null;
    }
}

