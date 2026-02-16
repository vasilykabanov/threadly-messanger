import React from "react";
import { useLongPress } from "../hooks/useLongPress";

/**
 * Компонент пузыря сообщения с поддержкой long press для контекстного меню.
 */
const MessageBubble = ({ content, timestamp, onLongPress, isPullGestureRef, renderMessageText, formatTime }) => {
    const longPressHandlers = useLongPress({
        onLongPress,
        maxMovement: 10,
        delay: 500,
        isPullGestureRef,
    });

    // Поддержка правого клика мыши для открытия контекстного меню (в дополнение к long press)
    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onLongPress(e, { x: e.clientX, y: e.clientY });
    };

    return (
        <p 
            className="message-bubble" 
            {...longPressHandlers}
            onContextMenu={handleContextMenu}
        >
            <span className="text">{renderMessageText(content)}</span>
            <span className="time">{formatTime(timestamp)}</span>
        </p>
    );
};

export default MessageBubble;
