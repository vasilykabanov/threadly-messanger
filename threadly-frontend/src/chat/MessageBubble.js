import React, { useEffect, useRef, useState } from "react";
import { EyeOutlined, EyeInvisibleOutlined, LoadingOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { Modal } from "antd";
import { useLongPress } from "../hooks/useLongPress";
import { fetchMessageImageAsBlobUrl, fetchMediaAsBlobUrl } from "../util/ApiUtil";

/** RECEIVED — доставлено, DELIVERED — прочитано */
const isRead = (status) => status === "DELIVERED";

/**
 * Пузырь сообщения. Для своих: PENDING — отправляется, FAILED — не доставлено, RECEIVED — доставлено, DELIVERED — прочитано.
 * messageType: "TEXT" | "IMAGE" | "VIDEO_CIRCLE" | "VOICE".
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
    onImageLoad,
    onReadStatusClick,
    readBy,
    groupMemberCount,
}) => {
    const [proxyImageUrl, setProxyImageUrl] = useState(null);
    const [imageLoadError, setImageLoadError] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const blobUrlRef = useRef(null);
    const cancelledRef = useRef(false);
    const lightboxJustClosedRef = useRef(false);

    // Media (video/voice) state
    const [mediaBlobUrl, setMediaBlobUrl] = useState(null);
    const [mediaLoading, setMediaLoading] = useState(false);
    const mediaBlobRef = useRef(null);
    const mediaCancelledRef = useRef(false);

    // Video circle player
    const videoRef = useRef(null);
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);

    // Voice player
    const audioRef = useRef(null);
    const [isVoicePlaying, setIsVoicePlaying] = useState(false);
    const [voiceCurrent, setVoiceCurrent] = useState(0);
    const [voiceDuration, setVoiceDuration] = useState(0);

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

    // Load media blob (video circle / voice)
    useEffect(() => {
        if ((messageType !== "VIDEO_CIRCLE" && messageType !== "VOICE") || !messageId) return;
        mediaCancelledRef.current = false;
        setMediaBlobUrl(null);
        setMediaLoading(true);
        setIsVoicePlaying(false);
        setIsVideoPlaying(false);
        setVoiceCurrent(0);
        setVoiceDuration(0);
        fetchMediaAsBlobUrl(messageId).then((url) => {
            if (mediaCancelledRef.current) {
                if (url) URL.revokeObjectURL(url);
                return;
            }
            if (url) {
                mediaBlobRef.current = url;
                setMediaBlobUrl(url);
            }
            setMediaLoading(false);
        });
        return () => {
            mediaCancelledRef.current = true;
            if (mediaBlobRef.current) {
                URL.revokeObjectURL(mediaBlobRef.current);
                mediaBlobRef.current = null;
            }
        };
    }, [messageId, messageType]);

    // Sync voice player state with <audio>
    useEffect(() => {
        if (messageType !== "VOICE") return;
        const audioEl = audioRef.current;
        if (!audioEl) return;

        const handleLoadedMetadata = () => {
            const d = audioEl.duration;
            if (Number.isFinite(d) && d > 0) {
                setVoiceDuration(d);
            }
        };
        const handleTimeUpdate = () => {
            const t = audioEl.currentTime || 0;
            setVoiceCurrent(t);
            // На некоторых браузерах duration появляется только во время воспроизведения
            const d = audioEl.duration;
            if (!voiceDuration && Number.isFinite(d) && d > 0) {
                setVoiceDuration(d);
            }
        };
        const handleEnded = () => {
            setIsVoicePlaying(false);
            const d = audioEl.duration;
            if (Number.isFinite(d) && d > 0) {
                setVoiceDuration(d);
                setVoiceCurrent(d);
            }
        };

        audioEl.addEventListener("loadedmetadata", handleLoadedMetadata);
        audioEl.addEventListener("timeupdate", handleTimeUpdate);
        audioEl.addEventListener("ended", handleEnded);

        return () => {
            audioEl.removeEventListener("loadedmetadata", handleLoadedMetadata);
            audioEl.removeEventListener("timeupdate", handleTimeUpdate);
            audioEl.removeEventListener("ended", handleEnded);
        };
    }, [messageType, mediaBlobUrl]);

    // Sync video circle state with <video>
    useEffect(() => {
        if (messageType !== "VIDEO_CIRCLE") return;
        const el = videoRef.current;
        if (!el) return;

        const handleEnded = () => {
            setIsVideoPlaying(false);
        };
        const handlePause = () => {
            // На pause тоже сбрасываем флаг, чтобы иконка вернулась в состояние play
            setIsVideoPlaying(false);
        };

        el.addEventListener("ended", handleEnded);
        el.addEventListener("pause", handlePause);

        return () => {
            el.removeEventListener("ended", handleEnded);
            el.removeEventListener("pause", handlePause);
        };
    }, [messageType, mediaBlobUrl]);

    const toggleVoicePlayback = () => {
        if (!audioRef.current) return;
        if (isVoicePlaying) {
            audioRef.current.pause();
            setIsVoicePlaying(false);
        } else {
            audioRef.current
                .play()
                .then(() => setIsVoicePlaying(true))
                .catch(() => setIsVoicePlaying(false));
        }
    };

    const formatVoiceTime = (seconds) => {
        const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
        const m = Math.floor(safe / 60)
            .toString()
            .padStart(2, "0");
        const s = Math.floor(safe % 60)
            .toString()
            .padStart(2, "0");
        return `${m}:${s}`;
    };

    const toggleVideoPlayback = () => {
        const el = videoRef.current;
        if (!el) return;
        if (isVideoPlaying) {
            el.pause();
            setIsVideoPlaying(false);
        } else {
            el
                .play()
                .then(() => setIsVideoPlaying(true))
                .catch(() => setIsVideoPlaying(false));
        }
    };

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

    const isGroupContext = groupMemberCount > 0;
    const readCount = isGroupContext ? Math.max(0, (readBy?.length || 1) - 1) : 0;
    const totalOthers = isGroupContext ? Math.max(0, groupMemberCount - 1) : 0;

    const isImage = messageType === "IMAGE";
    const isVideoCircle = messageType === "VIDEO_CIRCLE";
    const isVoice = messageType === "VOICE";
    // Используем только blob URL из прокси, чтобы не слать запросы к presigned URL (они отменяются и могут блокироваться ORB)
    const displayImageUrl = isImage ? proxyImageUrl : null;

    return (
        <p
            className={`message-bubble ${isImage ? "message-bubble--image" : ""} ${isVideoCircle ? "message-bubble--video-circle" : ""} ${isVoice ? "message-bubble--voice" : ""}`}
            {...longPressHandlers}
            onContextMenu={handleContextMenu}
        >
            {isVideoCircle ? (
                <span className="message-bubble-video-circle-wrap">
                    {mediaBlobUrl ? (
                        <>
                            <video
                                ref={videoRef}
                                src={mediaBlobUrl}
                                className="video-circle-player"
                                playsInline
                                preload="metadata"
                                onLoadedData={() => {
                                    if (onImageLoad) requestAnimationFrame(() => onImageLoad());
                                }}
                                muted={false}
                            />
                            <button
                                type="button"
                                className={`video-circle-play-btn ${isVideoPlaying ? "video-circle-play-btn--playing" : ""}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleVideoPlayback();
                                }}
                                aria-label={isVideoPlaying ? "Пауза видео" : "Воспроизвести видео"}
                            >
                                {isVideoPlaying ? (
                                    <span className="video-circle-icon video-circle-icon--pause" />
                                ) : (
                                    <span className="video-circle-icon video-circle-icon--play" />
                                )}
                            </button>
                        </>
                    ) : mediaLoading ? (
                        <span className="video-circle-placeholder">
                            <LoadingOutlined spin />
                        </span>
                    ) : (
                        <span className="video-circle-placeholder">🔵</span>
                    )}
                </span>
            ) : isVoice ? (
                <span
                    className="message-bubble-voice-wrap"
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                >
                    {mediaBlobUrl ? (
                        <>
                            <button
                                type="button"
                                className={`voice-play-btn ${isVoicePlaying ? "voice-play-btn--playing" : ""}`}
                                onClick={toggleVoicePlayback}
                                aria-label={isVoicePlaying ? "Пауза голосового сообщения" : "Воспроизвести голосовое сообщение"}
                            >
                                {isVoicePlaying ? (
                                    <span className="voice-play-icon voice-play-icon--pause" />
                                ) : (
                                    <span className="voice-play-icon voice-play-icon--play" />
                                )}
                            </button>
                            <div className="voice-wave">
                                <div
                                    className={`voice-wave-fill ${
                                        isVoicePlaying ? "voice-wave-fill--active" : ""
                                    }`}
                                    style={{
                                        width:
                                            voiceDuration > 0
                                                ? `${Math.min(100, Math.max(0, (voiceCurrent / voiceDuration) * 100))}%`
                                                : "0%",
                                    }}
                                />
                            </div>
                            <span className="voice-time">
                                {formatVoiceTime(voiceCurrent || 0)} / {formatVoiceTime(voiceDuration || voiceCurrent || 0)}
                            </span>
                            <audio
                                ref={audioRef}
                                src={mediaBlobUrl}
                                preload="metadata"
                                style={{ display: "none" }}
                            />
                        </>
                    ) : mediaLoading ? (
                        <span className="voice-placeholder">
                            <LoadingOutlined spin /> Загрузка…
                        </span>
                    ) : (
                        <span className="voice-placeholder">🎤 Голосовое сообщение</span>
                    )}
                </span>
            ) : isImage && displayImageUrl ? (
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
                        onLoad={() => {
                            if (onImageLoad) requestAnimationFrame(() => onImageLoad());
                        }}
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
                {isGroupContext && isOwn && !isPending && !isFailed && (
                    <span
                        className="read-indicator read-indicator-clickable"
                        title={`Прочитали: ${readCount}/${totalOthers}`}
                        aria-label={`Прочитали: ${readCount} из ${totalOthers}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onReadStatusClick) onReadStatusClick();
                        }}
                        role="button"
                        tabIndex={0}
                    >
                        {readCount >= totalOthers && totalOthers > 0 ? (
                            <EyeOutlined className="read-icon read" />
                        ) : (
                            <EyeInvisibleOutlined className="read-icon unread" />
                        )}
                    </span>
                )}
                {!isGroupContext && showReadIndicator && (
                    <span
                        className="read-indicator read-indicator-clickable"
                        title={isRead(status) ? "Прочитано" : "Доставлено"}
                        aria-label={isRead(status) ? "Прочитано" : "Доставлено"}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onReadStatusClick) onReadStatusClick();
                        }}
                        role="button"
                        tabIndex={0}
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
