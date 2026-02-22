package ru.vkabanov.threadlychat.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.Optional;

/**
 * Заглушка, когда объектное хранилище отключено (threadly.storage.enabled=false).
 */
@Service
@ConditionalOnProperty(name = "threadly.storage.enabled", havingValue = "false")
public class NoOpImageStorageService implements ImageStorageService {

    @Override
    public String upload(InputStream inputStream, long size, String contentType, String objectKey) {
        throw new UnsupportedOperationException("Image storage is disabled. Set threadly.storage.enabled=true and configure MinIO/S3.");
    }

    @Override
    public Optional<ImageStreamResult> getObjectStream(String objectKey) {
        return Optional.empty();
    }

    @Override
    public Optional<String> getPresignedUrl(String objectKey) {
        return Optional.empty();
    }

    @Override
    public void delete(String objectKey) {
        // no-op
    }

    @Override
    public boolean isEnabled() {
        return false;
    }
}
