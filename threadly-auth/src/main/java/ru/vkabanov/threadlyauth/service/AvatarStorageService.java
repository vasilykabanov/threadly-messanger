package ru.vkabanov.threadlyauth.service;

import java.io.InputStream;
import java.util.Optional;

public interface AvatarStorageService {

    String upload(InputStream inputStream, long size, String contentType, String objectKey);

    Optional<AvatarStreamResult> getObjectStream(String objectKey);

    Optional<String> getPresignedUrl(String objectKey);

    void delete(String objectKey);

    boolean isEnabled();
}

