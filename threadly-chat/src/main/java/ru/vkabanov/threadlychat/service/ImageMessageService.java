package ru.vkabanov.threadlychat.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import ru.vkabanov.threadlychat.configuration.ImageValidationProperties;
import ru.vkabanov.threadlychat.exception.BadRequestException;
import ru.vkabanov.threadlychat.exception.ForbiddenException;
import ru.vkabanov.threadlychat.model.ChatMessage;
import ru.vkabanov.threadlychat.model.ChatRoom;
import ru.vkabanov.threadlychat.model.MessageType;
import ru.vkabanov.threadlychat.repository.ChatRoomRepository;
import ru.vkabanov.threadlychat.security.CurrentUser;

import java.io.InputStream;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ImageMessageService {

    private final ImageStorageService imageStorageService;

    private final ChatMessageService chatMessageService;

    private final ChatRoomRepository chatRoomRepository;

    private final ImageValidationProperties imageValidation;

    private static final List<String> ALLOWED_EXTENSIONS = List.of("jpg", "jpeg", "png", "webp");

    /**
     * Загружает изображение в хранилище и создаёт сообщение типа IMAGE в чате.
     *
     * @param currentUser текущий пользователь (отправитель)
     * @param chatId      идентификатор чата (должен существовать)
     * @param file        файл изображения (multipart)
     * @return сохранённое сообщение с заполненным imageUrl (presigned)
     */
    public ChatMessage sendImageMessage(CurrentUser currentUser, String chatId, MultipartFile file) {
        if (!imageStorageService.isEnabled()) {
            throw new BadRequestException("Image upload is not available");
        }

        ChatRoom room = chatRoomRepository.findFirstByChatId(chatId)
                .orElseThrow(() -> new BadRequestException("Chat not found: " + chatId));

        String senderId = currentUser.getUserId();
        boolean isParticipant = room.getSenderId().equals(senderId) || room.getRecipientId().equals(senderId);
        if (!isParticipant) {
            throw new ForbiddenException("You are not a participant of this chat");
        }

        String recipientId = room.getSenderId().equals(senderId) ? room.getRecipientId() : room.getSenderId();

        validateFile(file);

        String contentType = file.getContentType();
        if (contentType == null) {
            contentType = "application/octet-stream";
        }
        String extension = extensionFromContentType(contentType);
        String objectKey = "chats/" + chatId + "/" + UUID.randomUUID() + "." + extension;

        try (InputStream is = file.getInputStream()) {
            imageStorageService.upload(is, file.getSize(), contentType, objectKey);
        } catch (Exception e) {
            log.error("Upload failed for chat {}: {}", chatId, e.getMessage());
            throw new BadRequestException("Failed to upload image");
        }

        ChatMessage message = ChatMessage.builder()
                .chatId(chatId)
                .senderId(senderId)
                .recipientId(recipientId)
                .senderName(null)
                .recipientName(null)
                .content("[Photo]")
                .messageType(MessageType.IMAGE)
                .imageKey(objectKey)
                .timestamp(new java.util.Date())
                .build();

        ChatMessage saved = chatMessageService.sendMessage(message);
        enrichWithImageUrl(saved);
        return saved;
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("No file provided");
        }
        if (file.getSize() > imageValidation.getMaxSizeBytes()) {
            long maxMb = imageValidation.getMaxSizeBytes() / (1024 * 1024);
            throw new BadRequestException("File size exceeds maximum allowed (" + maxMb + " MB)");
        }
        String contentType = file.getContentType();
        if (contentType == null || !imageValidation.getAllowedContentTypes().contains(contentType)) {
            throw new BadRequestException("Invalid file type. Allowed: " + String.join(", ", imageValidation.getAllowedContentTypes()));
        }
        String originalFilename = file.getOriginalFilename();
        if (originalFilename != null) {
            String ext = originalFilename.contains(".") ? originalFilename.substring(originalFilename.lastIndexOf('.') + 1).toLowerCase() : "";
            if (!ALLOWED_EXTENSIONS.contains(ext)) {
                throw new BadRequestException("Invalid file extension. Allowed: jpg, jpeg, png, webp");
            }
        }
    }

    private static String extensionFromContentType(String contentType) {
        if (contentType == null) return "jpg";
        return switch (contentType.toLowerCase()) {
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> "jpg";
        };
    }

    /**
     * Заполняет imageUrl (presigned) для сообщения типа IMAGE.
     */
    public void enrichWithImageUrl(ChatMessage message) {
        if (message != null && message.getMessageType() == MessageType.IMAGE && message.getImageKey() != null) {
            imageStorageService.getPresignedUrl(message.getImageKey()).ifPresent(message::setImageUrl);
        }
    }

    /**
     * Заполняет imageUrl для списка сообщений.
     */
    public void enrichWithImageUrls(List<ChatMessage> messages) {
        if (messages != null) {
            messages.forEach(this::enrichWithImageUrl);
        }
    }

    /**
     * Возвращает presigned URL для изображения сообщения, если текущий пользователь — участник чата.
     */
    public Optional<String> getImageUrl(String messageId, CurrentUser currentUser) {
        ChatMessage message = chatMessageService.findById(messageId);
        ensureParticipant(currentUser, message);
        if (message.getMessageType() != MessageType.IMAGE || message.getImageKey() == null) {
            return Optional.empty();
        }
        return imageStorageService.getPresignedUrl(message.getImageKey());
    }

    /**
     * Открывает поток изображения сообщения для проксирования (обход ORB). Участник чата проверяется.
     */
    public Optional<ImageStreamResult> getImageStream(String messageId, CurrentUser currentUser) {
        ChatMessage message = chatMessageService.findById(messageId);
        ensureParticipant(currentUser, message);
        if (message.getMessageType() != MessageType.IMAGE || message.getImageKey() == null) {
            return Optional.empty();
        }
        return imageStorageService.getObjectStream(message.getImageKey());
    }

    private void ensureParticipant(CurrentUser currentUser, ChatMessage message) {
        boolean participant = currentUser.getUserId().equals(message.getSenderId())
                || currentUser.getUserId().equals(message.getRecipientId());
        if (!participant) {
            throw new ForbiddenException("You are not a participant of this conversation");
        }
    }
}
