import React, { useEffect, useRef, useState } from "react";
import { EyeOutlined, EyeInvisibleOutlined, LoadingOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { Modal } from "antd";
import { useLongPress } from "../hooks/useLongPress";
import { fetchMessageImageAsBlobUrl } from "../util/ApiUtil";

/** RECEIVED — доставлено, DELIVERED — прочитано */
const isRead = (status) => status === "DELIVERED";

/**
 * Пузырь сообщения. Для своих: PENDING — отправляется, FAILED — не доставлено, RECEIVED — доставлено, DELIVERED — прочитано.
 * messageType: "TEXT" | "IMAGE". Для IMAGE передаётся imageUrl (presigned) и опционально content как подпись.
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
    messageType = "TEXT",
    imageUrl,
    messageId,
}) => {
    const [proxyImageUrl, setProxyImageUrl] = useState(null);
    const [imageLoadError, setImageLoadError] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const blobUrlRef = useRef(null);
    const cancelledRef = useRef(false);
    const lightboxJustClosedRef = useRef(false);

    const handleCloseLightbox = () => {
        setLightboxOpen(false);
        lightboxJustClosedRef.current = true;
        setTimeout(() => {
            lightboxJustClosedRef.current = false;
        }, 400);
    };

    const handleLongPress = (e, position) => {
        if (lightboxJustClosedRef.current) return;
        onLongPress(e, position);
    };

    useEffect(() => {
        if (messageType !== "IMAGE" || !messageId) return;
        setProxyImageUrl(null);
        setImageLoadError(false);
        cancelledRef.current = false;
        fetchMessageImageAsBlobUrl(messageId).then((url) => {
            if (cancelledRef.current) {
                if (url) URL.revokeObjectURL(url);
                return;
            }
            if (url) {
                blobUrlRef.current = url;
                setProxyImageUrl(url);
            } else {
                setImageLoadError(true);
            }
        });
        return () => {
            cancelledRef.current = true;
            if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current);
                blobUrlRef.current = null;
            }
        };
    }, [messageId, messageType]);

    const longPressHandlers = useLongPress({
        onLongPress: handleLongPress,
        maxMovement: 10,
        delay: 500,
        isPullGestureRef,
    });

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (lightboxJustClosedRef.current) return;
        onLongPress(e, { x: e.clientX, y: e.clientY });
    };

    const showReadIndicator = isOwn && status != null && (status === "RECEIVED" || status === "DELIVERED");
    const isPending = isOwn && status === "PENDING";
    const isFailed = isOwn && status === "FAILED";

    const isImage = messageType === "IMAGE";
    // Используем только blob URL из прокси, чтобы не слать запросы к presigned URL (они отменяются и могут блокироваться ORB)
    const displayImageUrl = isImage ? proxyImageUrl : null;

    return (
        <p
            className={`message-bubble ${isImage ? "message-bubble--image" : ""}`}
            {...longPressHandlers}
            onContextMenu={handleContextMenu}
        >
            {isImage && displayImageUrl ? (
                <span className="message-bubble-image-wrap">
                    <img
                        src={displayImageUrl}
                        alt=""
                        className="message-bubble-image message-bubble-image-clickable"
                        loading="lazy"
                        onClick={() => setLightboxOpen(true)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && setLightboxOpen(true)}
                        aria-label="Открыть фото"
                        title="Открыть фото"
                    />
                    {content && content !== "[Photo]" && (
                        <span className="text message-bubble-image-caption">{renderMessageText(content)}</span>
                    )}
                    <Modal
                        open={lightboxOpen}
                        onCancel={handleCloseLightbox}
                        footer={[
                            <button
                                key="newtab"
                                type="button"
                                className="ant-btn ant-btn-default"
                                onClick={() => displayImageUrl && window.open(displayImageUrl, "_blank", "noopener")}
                            >
                                Открыть в новой вкладке
                            </button>,
                            <button
                                key="close"
                                type="button"
                                className="ant-btn ant-btn-primary"
                                onClick={handleCloseLightbox}
                            >
                                Закрыть
                            </button>,
                        ]}
                        width="90vw"
                        style={{ top: 24 }}
                        centered
                        destroyOnClose
                    >
                        <img
                            src={displayImageUrl}
                            alt=""
                            style={{ width: "100%", height: "auto", display: "block" }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </Modal>
                </span>
            ) : isImage ? (
                <span className="text message-bubble-image-placeholder">
                    {!proxyImageUrl && !imageLoadError && <LoadingOutlined spin className="message-bubble-image-loading" />}
                    {imageLoadError && "[Фото]"}
                </span>
            ) : (
                <span className="text">{renderMessageText(content)}</span>
            )}
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
