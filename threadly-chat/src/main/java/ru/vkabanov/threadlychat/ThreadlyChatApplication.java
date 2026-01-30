package ru.vkabanov.threadlychat;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class ThreadlyChatApplication {

    public static void main(String[] args) {
        SpringApplication.run(ThreadlyChatApplication.class, args);
    }

}
