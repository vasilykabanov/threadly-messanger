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
public class ChatImagesPage {

    private List<ChatMessage> items;

    /**
     * Есть ли ещё изображения после текущей страницы.
     */
    private boolean hasMore;

    /**
     * Номер следующей страницы (page), если hasMore == true, иначе null.
     */
    private Integer nextPage;
}

