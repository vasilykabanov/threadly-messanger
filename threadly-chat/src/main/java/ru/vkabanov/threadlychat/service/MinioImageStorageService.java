package ru.vkabanov.threadlychat.service;

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
import ru.vkabanov.threadlychat.configuration.StorageProperties;

import javax.annotation.PostConstruct;
import java.io.InputStream;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/**
 * Хранение изображений чата в MinIO.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "threadly.storage.enabled", havingValue = "true")
public class MinioImageStorageService implements ImageStorageService {

    private final StorageProperties properties;

    private MinioClient minioClient;

    @PostConstruct
    public void init() {
        try {
            minioClient = MinioClient.builder()
                    .endpoint(properties.getEndpoint())
                    .credentials(properties.getAccessKey(), properties.getSecretKey())
                    .build();
            if (properties.getPresignedEndpoint() != null && !properties.getPresignedEndpoint().isBlank()) {
                log.info("Presigned URLs will be rewritten to: {}", properties.getPresignedEndpoint());
            }
            ensureBucket();
        } catch (Exception e) {
            log.error("Failed to initialize MinIO client: {}", e.getMessage());
            throw new IllegalStateException("Storage initialization failed", e);
        }
    }

    private void ensureBucket() {
        try {
            if (!minioClient.bucketExists(io.minio.BucketExistsArgs.builder().bucket(properties.getBucket()).build())) {
                minioClient.makeBucket(io.minio.MakeBucketArgs.builder().bucket(properties.getBucket()).build());
                log.info("Created MinIO bucket: {}", properties.getBucket());
            }
        } catch (Exception e) {
            log.warn("Could not ensure bucket exists: {}", e.getMessage());
        }
    }

    @Override
    public Optional<ImageStreamResult> getObjectStream(String objectKey) {
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
            return Optional.of(new ImageStreamResult(response, contentType));
        } catch (Exception e) {
            log.warn("Failed to get object stream for {}: {}", objectKey, e.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public String upload(InputStream inputStream, long size, String contentType, String objectKey) {
        try {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(properties.getBucket())
                    .object(objectKey)
                    .stream(inputStream, size, -1)
                    .contentType(contentType != null ? contentType : "application/octet-stream")
                    .build());
            return objectKey;
        } catch (Exception e) {
            log.error("Upload failed for key {}: {}", objectKey, e.getMessage());
            throw new RuntimeException("Failed to upload image", e);
        }
    }

    @Override
    public Optional<String> getPresignedUrl(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return Optional.empty();
        }
        try {
            // Всегда генерируем URL через внутренний endpoint (minio:9000), чтобы из контейнера не подключаться к localhost
            String url = minioClient.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
                    .method(Method.GET)
                    .bucket(properties.getBucket())
                    .object(objectKey)
                    .expiry(properties.getPresignedExpirySeconds(), TimeUnit.SECONDS)
                    .build());
            // Подмена хоста в ссылке: браузер должен открывать presignedEndpoint (например localhost:9000), а не minio:9000
            if (properties.getPresignedEndpoint() != null && !properties.getPresignedEndpoint().isBlank()) {
                String internal = properties.getEndpoint().replaceFirst("^https?://", "").replaceFirst("/$", "");
                String replacement = properties.getPresignedEndpoint().replaceFirst("/$", "");
                url = url.replaceFirst("(?i)^https?://" + Pattern.quote(internal), replacement);
            }
            return Optional.of(url);
        } catch (Exception e) {
            log.warn("Failed to get presigned URL for {}: {}", objectKey, e.getMessage());
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
            log.warn("Failed to delete object {}: {}", objectKey, e.getMessage());
        }
    }

    @Override
    public boolean isEnabled() {
        return properties.isEnabled() && minioClient != null;
    }
}
