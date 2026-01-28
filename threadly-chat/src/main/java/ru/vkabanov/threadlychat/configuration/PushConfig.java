package ru.vkabanov.threadlychat.configuration;

import lombok.Data;
import nl.martijndwars.webpush.PushService;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.security.GeneralSecurityException;
import java.security.Security;

@Configuration
@EnableConfigurationProperties(PushConfig.PushProperties.class)
public class PushConfig {

    @Bean
    public PushService pushService(PushProperties props) throws GeneralSecurityException {
        Security.addProvider(new BouncyCastleProvider());

        String publicKey = props.getVapid().getPublicKey();
        String privateKey = props.getVapid().getPrivateKey();
        String subject = props.getVapid().getSubject();

        // Если ключи не заданы — просто не включаем Web Push (приложение должно стартовать).
        if (publicKey == null || publicKey.isBlank() || privateKey == null || privateKey.isBlank()) {
            return new PushService();
        }

        // webpush-java умеет принимать VAPID ключи в виде Base64URL-строк
        return new PushService(publicKey, privateKey, subject);
    }

    @Data
    @ConfigurationProperties(prefix = "threadly.push")
    public static class PushProperties {
        private Vapid vapid = new Vapid();

        @Data
        public static class Vapid {
            private String publicKey;
            private String privateKey;
            private String subject;
        }
    }
}

