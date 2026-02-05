package ru.vkabanov.threadlyauth.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import ru.vkabanov.threadlyauth.model.User;

import javax.mail.MessagingException;
import javax.mail.internet.MimeMessage;

@Service
@Slf4j
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.from}")
    private String fromEmail;

    @Value("${app.mail.from-name}")
    private String fromName;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Async
    public void sendVerificationEmail(User user) {
        String verificationLink = frontendUrl + "/verify-email?token=" + user.getEmailVerificationToken();
        
        String subject = "Подтверждение регистрации в Threadly";
        String htmlContent = buildVerificationEmailHtml(user.getUsername(), verificationLink);

        sendHtmlEmail(user.getEmail(), subject, htmlContent);
    }

    @Async
    public void sendPasswordResetEmail(User user, String resetToken) {
        String resetLink = frontendUrl + "/reset-password?token=" + resetToken;
        
        String subject = "Сброс пароля в Threadly";
        String htmlContent = buildPasswordResetEmailHtml(user.getUsername(), resetLink);

        sendHtmlEmail(user.getEmail(), subject, htmlContent);
    }

    private void sendHtmlEmail(String to, String subject, String htmlContent) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            
            helper.setFrom(fromEmail, fromName);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);

            mailSender.send(message);
            log.info("Email sent successfully to {}", to);
        } catch (MessagingException | java.io.UnsupportedEncodingException e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage());
        }
    }

    private String buildVerificationEmailHtml(String username, String verificationLink) {
        return """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Threadly</h1>
                    </div>
                    <div class="content">
                        <h2>Привет, %s!</h2>
                        <p>Спасибо за регистрацию в Threadly. Для завершения регистрации подтверди свой email, нажав на кнопку ниже:</p>
                        <p style="text-align: center;">
                            <a href="%s" class="button">Подтвердить email</a>
                        </p>
                        <p>Или скопируй ссылку в браузер:</p>
                        <p style="word-break: break-all; color: #667eea;">%s</p>
                        <p>Если ты не регистрировался в Threadly, просто проигнорируй это письмо.</p>
                    </div>
                    <div class="footer">
                        <p>Это автоматическое сообщение, не отвечай на него.</p>
                    </div>
                </div>
            </body>
            </html>
            """.formatted(username, verificationLink, verificationLink);
    }

    private String buildPasswordResetEmailHtml(String username, String resetLink) {
        return """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Threadly</h1>
                    </div>
                    <div class="content">
                        <h2>Привет, %s!</h2>
                        <p>Мы получили запрос на сброс пароля для твоего аккаунта. Нажми на кнопку ниже, чтобы создать новый пароль:</p>
                        <p style="text-align: center;">
                            <a href="%s" class="button">Сбросить пароль</a>
                        </p>
                        <p>Ссылка действительна в течение 1 часа.</p>
                        <p>Если ты не запрашивал сброс пароля, просто проигнорируй это письмо.</p>
                    </div>
                    <div class="footer">
                        <p>Это автоматическое сообщение, не отвечай на него.</p>
                    </div>
                </div>
            </body>
            </html>
            """.formatted(username, resetLink);
    }
}
