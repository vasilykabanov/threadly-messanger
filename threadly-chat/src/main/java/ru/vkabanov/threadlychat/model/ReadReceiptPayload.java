package ru.vkabanov.threadlychat.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Отправляется отправителю сообщений, когда получатель прочитал чат.
 * readerId — кто прочитал (recipient в диалоге).
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class ReadReceiptPayload {
    private String readerId;
}
