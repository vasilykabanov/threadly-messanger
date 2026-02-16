import React from "react";
import { EyeOutlined, EyeInvisibleOutlined } from "@ant-design/icons";
import { useLongPress } from "../hooks/useLongPress";

/** Статус прочтения: RECEIVED — не прочитано, DELIVERED — прочитано */
const isRead = (status) => status === "DELIVERED";

/**
 * Компонент пузыря сообщения с поддержкой long press и индикатором прочтения (только для своих).
 */
const MessageBubble = ({
    content,
    timestamp,
    onLongPress,
    isPullGestureRef,
    renderMessageText,
    formatTime,
    isOwn,
    status,
}) => {
    const longPressHandlers = useLongPress({
        onLongPress,
        maxMovement: 10,
        delay: 500,
        isPullGestureRef,
    });

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onLongPress(e, { x: e.clientX, y: e.clientY });
    };

    const read = isOwn && status != null;

    return (
        <p
            className="message-bubble"
            {...longPressHandlers}
            onContextMenu={handleContextMenu}
        >
            <span className="text">{renderMessageText(content)}</span>
            <span className="message-bubble-footer">
                <span className="time">{formatTime(timestamp)}</span>
                {read && (
                    <span
                        className="read-indicator"
                        title={isRead(status) ? "Прочитано" : "Не прочитано"}
                        aria-label={isRead(status) ? "Прочитано" : "Не прочитано"}
                    >
                        {isRead(status) ? (
                            <EyeOutlined className="read-icon read" />
                        ) : (
                            <EyeInvisibleOutlined className="read-icon unread" />
                        )}
                    </span>
                )}
            </span>
        </p>
    );
};

export default MessageBubble;
