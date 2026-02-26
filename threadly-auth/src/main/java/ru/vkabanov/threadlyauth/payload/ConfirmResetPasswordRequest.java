package ru.vkabanov.threadlyauth.payload;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
public class ConfirmResetPasswordRequest {

    @NotBlank(message = "Токен обязателен")
    private String token;

    @NotBlank(message = "Введите новый пароль")
    @Size(min = 6, max = 20, message = "Пароль от 6 до 20 символов")
    private String newPassword;

    @NotBlank(message = "Повторите пароль")
    private String confirmPassword;
}
