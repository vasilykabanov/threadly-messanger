package ru.vkabanov.threadlychat.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;
import java.util.Set;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Document
public class ChatMessage {
   @Id
   private String id;
   private String chatId;
   private String senderId;
   private String recipientId;
   private String senderName;
   private String recipientName;
   /** Текст сообщения (для TEXT) или подпись/описание (для IMAGE, опционально). */
   private String content;
   private Date timestamp;
   private MessageStatus status;
   private Set<String> deletedFor;

   /** Тип сообщения: TEXT или IMAGE. По умолчанию TEXT для обратной совместимости. */
   @Builder.Default
   private MessageType messageType = MessageType.TEXT;

   /** Ключ объекта в MinIO. Заполняется только для messageType == IMAGE. В БД хранится только ключ. */
   private String imageKey;

   /** Presigned URL для отображения изображения. Не сохраняется в БД, заполняется при отдаче клиенту. */
   @Transient
   private String imageUrl;

   /** Ключ объекта в MinIO для медиа-файлов (VIDEO_CIRCLE, VOICE). */
   private String mediaKey;

   /** URL для скачивания/стриминга медиа. Не сохраняется в БД, формируется при отдаче клиенту. */
   @Transient
   private String mediaDownloadUrl;

   /** Кто прочитал это сообщение (для групповых чатов). */
   private Set<String> readBy;
}
