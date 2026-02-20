import React from "react";
import { EyeOutlined, EyeInvisibleOutlined, LoadingOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { useLongPress } from "../hooks/useLongPress";

/** RECEIVED — доставлено, DELIVERED — прочитано */
const isRead = (status) => status === "DELIVERED";

/**
 * Пузырь сообщения. Для своих: PENDING — отправляется, FAILED — не доставлено, RECEIVED — доставлено, DELIVERED — прочитано.
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

    const showReadIndicator = isOwn && status != null && (status === "RECEIVED" || status === "DELIVERED");
    const isPending = isOwn && status === "PENDING";
    const isFailed = isOwn && status === "FAILED";

    return (
        <p
            className="message-bubble"
            {...longPressHandlers}
            onContextMenu={handleContextMenu}
        >
            <span className="text">{renderMessageText(content)}</span>
            <span className="message-bubble-footer">
                <span className="time">{formatTime(timestamp)}</span>
                {isPending && (
                    <span className="read-indicator status-pending" title="Отправляется" aria-label="Отправляется">
                        <LoadingOutlined className="read-icon pending" />
                    </span>
                )}
                {isFailed && (
                    <span className="read-indicator status-failed" title="Не доставлено" aria-label="Не доставлено">
                        <CloseCircleOutlined className="read-icon failed" />
                    </span>
                )}
                {showReadIndicator && (
                    <span
                        className="read-indicator"
                        title={isRead(status) ? "Прочитано" : "Доставлено"}
                        aria-label={isRead(status) ? "Прочитано" : "Доставлено"}
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
