package ru.vkabanov.threadlychat.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessagesPage {

    private List<ChatMessage> items;

    private boolean hasMore;

    private Integer nextPage;
}
