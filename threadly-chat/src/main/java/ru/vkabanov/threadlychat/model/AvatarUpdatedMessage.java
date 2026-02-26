package ru.vkabanov.threadlychat.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class AvatarUpdatedMessage {

    private String userId;

    private String avatarUrl;
}

