package ru.vkabanov.threadlyauth.service;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.io.InputStream;

@Data
@AllArgsConstructor
public class AvatarStreamResult {

    private InputStream stream;

    private String contentType;
}

