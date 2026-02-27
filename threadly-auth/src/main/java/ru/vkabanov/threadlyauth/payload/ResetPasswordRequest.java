package ru.vkabanov.threadlyauth.payload;

import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
public class ResetPasswordRequest {

    @NotBlank(message = "Введите логин или почту")
    private String usernameOrEmail;
}
