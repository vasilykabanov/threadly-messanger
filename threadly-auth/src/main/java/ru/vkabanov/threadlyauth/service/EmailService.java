package ru.vkabanov.threadlyauth.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import javax.mail.MessagingException;
import javax.mail.internet.MimeMessage;

@Service
@Slf4j
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.base-url:http://localhost:3000}")
    private String baseUrl;

    @Value("${spring.mail.username:noreply@threadly.ru}")
    private String fromEmail;

    public void sendPasswordResetEmail(String toEmail, String token) {
        String resetLink = baseUrl + "/reset-password?token=" + token;

        String subject = "Threadly — Сброс пароля";
        String htmlContent = "<div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">"
                + "<h2 style=\"color: #7c3aed;\">Threadly</h2>"
                + "<p>Вы запросили сброс пароля для вашего аккаунта.</p>"
                + "<p>Нажмите на кнопку ниже, чтобы установить новый пароль:</p>"
                + "<div style=\"text-align: center; margin: 30px 0;\">"
                + "<a href=\"" + resetLink + "\" style=\""
                + "background-color: #7c3aed; color: #ffffff; padding: 12px 32px; "
                + "text-decoration: none; border-radius: 24px; font-size: 16px;"
                + "\">Сбросить пароль</a>"
                + "</div>"
                + "<p style=\"color: #666;\">Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>"
                + "<p style=\"color: #999; font-size: 12px;\">Ссылка действительна в течение 1 часа.</p>"
                + "</div>";

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);
            mailSender.send(message);
            log.info("Password reset email sent to {}", toEmail);
        } catch (MessagingException e) {
            log.error("Failed to send password reset email to {}", toEmail, e);
            throw new RuntimeException("Не удалось отправить письмо", e);
        }
    }
}
