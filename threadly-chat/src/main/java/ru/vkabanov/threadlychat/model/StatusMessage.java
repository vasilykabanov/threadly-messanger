package ru.vkabanov.threadlychat.model;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class StatusMessage {

    private String userId;

    private String status;
}
