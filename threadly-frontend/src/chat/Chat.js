import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from "react";
import {Button, Drawer, message, Spin, Modal} from "antd";
import {
    getUsers,
    findChatMessage,
    getUserSummary,
    getChatContacts,
    getUnreadCounts,
    getStatuses,
    getCurrentUser,
    getUserIdFromToken,
    deleteChat as deleteChatRequest,
    ensurePushSubscribed,
    searchUsers,
    uploadImageMessage,
    getChatImages,
    fetchMessageImageAsBlobUrl,
    getChatMessagesPage,
    uploadMedia,
    fetchMediaAsBlobUrl,
} from "../util/ApiUtil";
import {useRecoilState} from "recoil";
import {
    loggedInUser,
    chatActiveContact,
    chatMessages,
} from "../atom/globalState";
import "./Chat.css";
import Avatar from "../profile/Avatar";
import {usePullToRefresh} from "../hooks/usePullToRefresh";
import MessageContextMenu from "./MessageContextMenu";
import MessageBubble from "./MessageBubble";
import {copyToClipboard} from "../util/clipboardUtil";
import {formatLastMessageDate} from "../util/dateFormatterUtil";

/** Превью фото из чата: загрузка через прокси (blob), чтобы не упираться в CORS presigned URL. */
function PhotoGridImage({ messageId, onClick }) {
    const [blobUrl, setBlobUrl] = useState(null);
    const blobRef = useRef(null);

    useEffect(() => {
        if (!messageId) return;
        let cancelled = false;
        fetchMessageImageAsBlobUrl(messageId).then((url) => {
            if (cancelled) {
                if (url) URL.revokeObjectURL(url);
                return;
            }
            if (url) {
                if (blobRef.current) URL.revokeObjectURL(blobRef.current);
                blobRef.current = url;
                setBlobUrl(url);
            }
        });
        return () => {
            cancelled = true;
            if (blobRef.current) {
                URL.revokeObjectURL(blobRef.current);
                blobRef.current = null;
            }
            setBlobUrl(null);
        };
    }, [messageId]);

    return (
        <button
            type="button"
            className="photos-grid-item"
            onClick={onClick}
            disabled={!blobUrl}
        >
            {blobUrl ? (
                <img src={blobUrl} alt="Фото из чата" loading="lazy" />
            ) : (
                <span className="photos-grid-placeholder" />
            )}
        </button>
    );
}

const setVH = () => {
    document.documentElement.style.setProperty(
        "--vh",
        `${window.innerHeight}px`
    );
};

setVH();
window.addEventListener("resize", setVH);

var stompClient = null;
const Chat = (props) => {
    const [currentUser, setLoggedInUser] = useRecoilState(loggedInUser);
    const [text, setText] = useState("");
    const [contacts, setContacts] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [activeContact, setActiveContact] = useRecoilState(chatActiveContact);
    const [messages, setMessages] = useRecoilState(chatMessages);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileData, setProfileData] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [lastMessageByContact, setLastMessageByContact] = useState({});
    const [isDeleteChatOpen, setIsDeleteChatOpen] = useState(false);
    const [deleteChatTarget, setDeleteChatTarget] = useState(null);
    const [deleteChatLoading, setDeleteChatLoading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const messagesContainerRef = useRef(null);
    const messagesListRef = useRef(null);
    const heartbeatIntervalRef = useRef(null);
    const connectUserIdRef = useRef(null);
    const pendingMessagesRef = useRef([]);
    const pendingTimeoutsRef = useRef({});
    const [isUserNearBottom, setIsUserNearBottom] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const [contextMenu, setContextMenu] = useState({
        visible: false,
        position: {x: 0, y: 0},
        messageContent: "",
    });
    const [imageUploading, setImageUploading] = useState(false);
    const fileInputRef = useRef(null);
    const [messagesPage, setMessagesPage] = useState(0);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [messagesLoadingOlder, setMessagesLoadingOlder] = useState(false);
    const scrollRestoreRef = useRef(null);
    const [photos, setPhotos] = useState([]);
    const [photosPage, setPhotosPage] = useState(0);
    const [photosHasMore, setPhotosHasMore] = useState(true);
    const [photosLoading, setPhotosLoading] = useState(false);
    const [photosError, setPhotosError] = useState(null);
    const photosScrollRef = useRef(null);
    const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
    const [activePhotoIndex, setActivePhotoIndex] = useState(0);
    const [viewerBlobUrl, setViewerBlobUrl] = useState(null);
    const viewerBlobRef = useRef(null);
    const [isAvatarViewerOpen, setIsAvatarViewerOpen] = useState(false);
    const [isContactAvatarViewerOpen, setIsContactAvatarViewerOpen] = useState(false);

    // Video circle recording
    const [isVideoRecording, setIsVideoRecording] = useState(false);
    const [videoRecordingTime, setVideoRecordingTime] = useState(0);
    const [facingMode, setFacingMode] = useState("user");
    const [torchOn, setTorchOn] = useState(false);
    const [videoUploading, setVideoUploading] = useState(false);
    const videoStreamRef = useRef(null);
    const videoMediaRecorderRef = useRef(null);
    const videoChunksRef = useRef([]);
    const videoPreviewRef = useRef(null);
    const videoTimerRef = useRef(null);

    // Voice recording
    const [isVoiceRecording, setIsVoiceRecording] = useState(false);
    const [voiceRecordingTime, setVoiceRecordingTime] = useState(0);
    const [voiceUploading, setVoiceUploading] = useState(false);
    const voiceStreamRef = useRef(null);
    const voiceMediaRecorderRef = useRef(null);
    const voiceChunksRef = useRef([]);
    const voiceTimerRef = useRef(null);

    useEffect(() => {
        document.body.classList.add("chat-page");
        document.documentElement.classList.add("chat-page");
        return () => {
            document.body.classList.remove("chat-page");
            document.documentElement.classList.remove("chat-page");
        };
    }, []);

    useEffect(() => {
        const handleResize = () => {
            if (typeof window === "undefined") return;
            setIsMobile(window.innerWidth <= 768);
        };

        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        if (localStorage.getItem("accessToken") === null) {
            props.history.push("/login");
            return;
        }
        getCurrentUser()
            .then((response) => setLoggedInUser(response))
            .catch(() => {});

        const userId = getUserIdFromToken();
        if (!userId) return;

        const activeUserId = sessionStorage.getItem("activeUserId");
        if (activeUserId && activeUserId !== userId) {
            setActiveContact(null);
            setMessages([]);
        }
        sessionStorage.setItem("activeUserId", userId);

        connect(userId);
        loadContacts(undefined, userId);
        ensurePushSubscribed(userId).catch(() => {});

        const handleVisibilityChange = () => {
            if (document.visibilityState !== "visible") return;
            if (stompClient && stompClient.connected) {
                sendStatusOnline();
            } else {
                const uid = getUserIdFromToken();
                if (uid) connect(uid);
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            Object.values(pendingTimeoutsRef.current).forEach(clearTimeout);
            pendingTimeoutsRef.current = {};
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
                heartbeatIntervalRef.current = null;
            }
            if (stompClient && stompClient.connected) {
                stompClient.disconnect(() => {
                    console.log("stomp disconnected");
                });
            }
            stompClient = null;
            setIsConnected(false);
        };
    }, []);

    useEffect(() => {
        setActiveContact(null);
        setMessages([]);
    }, []);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setSearchLoading(false);
            return;
        }
        setSearchLoading(true);
        const t = setTimeout(() => {
            searchUsers(searchQuery)
                .then((list) => setSearchResults(list || []))
                .catch(() => setSearchResults([]))
                .finally(() => setSearchLoading(false));
        }, 300);
        return () => clearTimeout(t);
    }, [searchQuery]);

    useEffect(() => {
        if (!activeContact?.id) return;

        // При переключении на другого собеседника считаем, что пользователь "у низа",
        // и сразу показываем конец нового чата.
        setIsUserNearBottom(true);
        loadChatForContact(activeContact);
    }, [activeContact?.id]);

    useLayoutEffect(() => {
        // Держим видимыми последние сообщения:
        // - при первом открытии длинного чата сразу показываем низ без анимации;
        // - при новых сообщениях скроллим вниз только если пользователь и так был рядом с концом;
        // - если пользователь пролистал вверх, позицию не трогаем.
        const container = messagesContainerRef.current;
        if (!container) return;
        if (!activeContact?.id) return;
        if (!messages.length) return;
        if (!isUserNearBottom) return;

        container.scrollTo({
            top: container.scrollHeight,
            behavior: "auto",
        });
    }, [messages.length, activeContact?.id, isUserNearBottom]);

    useEffect(() => {
        // После загрузки фото высота списка сообщений растёт — снова прокручиваем вниз, если пользователь у конца
        const container = messagesContainerRef.current;
        const listEl = messagesListRef.current;
        if (!container || !listEl || !activeContact?.id || !messages.length) return;

        const resizeObserver = new ResizeObserver(() => {
            if (!isUserNearBottom) return;
            container.scrollTo({
                top: container.scrollHeight,
                behavior: "auto",
            });
        });
        resizeObserver.observe(listEl);
        return () => resizeObserver.disconnect();
    }, [activeContact?.id, messages.length, isUserNearBottom]);

    useLayoutEffect(() => {
        const restore = scrollRestoreRef.current;
        if (!restore) return;
        const container = messagesContainerRef.current;
        if (!container) return;
        const newScrollHeight = container.scrollHeight;
        container.scrollTop = restore.scrollTop + (newScrollHeight - restore.scrollHeight);
        scrollRestoreRef.current = null;
    }, [messages]);

    const scrollMessagesToBottomIfNear = useCallback(() => {
        if (!isUserNearBottom) return;
        const container = messagesContainerRef.current;
        if (!container) return;
        container.scrollTo({ top: container.scrollHeight, behavior: "auto" });
    }, [isUserNearBottom]);

    useEffect(() => {
        if (!activeContact?.username) return;
        loadContactProfile(activeContact);
    }, [activeContact?.username]);

    const loadChatImages = (reset = false) => {
        const chatId = getChatId();
        if (!chatId) return;
        if (!reset && (!photosHasMore || photosLoading)) return;

        const pageToLoad = reset ? 0 : photosPage;
        if (reset) {
            setPhotosError(null);
            setPhotos([]);
            setPhotosHasMore(true);
        }
        setPhotosLoading(true);

        getChatImages(chatId, pageToLoad, 60)
            .then((data) => {
                const items = data?.items || [];
                setPhotos((prev) => reset ? items : [...prev, ...items]);
                setPhotosHasMore(Boolean(data?.hasMore));
                if (data?.nextPage != null) {
                    setPhotosPage(data.nextPage);
                } else {
                    setPhotosPage(pageToLoad);
                }
            })
            .catch(() => {
                setPhotosError("Не удалось загрузить фотографии");
            })
            .finally(() => setPhotosLoading(false));
    };

    useEffect(() => {
        if (!isProfileOpen) return;
        if (!activeContact?.id) return;
        loadChatImages(true);
    }, [isProfileOpen, activeContact?.id]);

    useEffect(() => {
        if (!isPhotoViewerOpen || !photos.length) {
            if (viewerBlobRef.current) {
                URL.revokeObjectURL(viewerBlobRef.current);
                viewerBlobRef.current = null;
            }
            setViewerBlobUrl(null);
            return;
        }
        const msg = photos[activePhotoIndex];
        const messageId = msg?.id;
        if (!messageId) return;
        let cancelled = false;
        fetchMessageImageAsBlobUrl(messageId).then((url) => {
            if (cancelled) {
                if (url) URL.revokeObjectURL(url);
                return;
            }
            if (viewerBlobRef.current) URL.revokeObjectURL(viewerBlobRef.current);
            viewerBlobRef.current = url;
            setViewerBlobUrl(url);
        });
        return () => {
            cancelled = true;
            if (viewerBlobRef.current) {
                URL.revokeObjectURL(viewerBlobRef.current);
                viewerBlobRef.current = null;
            }
            setViewerBlobUrl(null);
        };
    }, [isPhotoViewerOpen, activePhotoIndex, photos]);

    const sendStatusOnline = () => {
        if (stompClient && stompClient.connected) {
            try {
                stompClient.send("/app/status", {}, JSON.stringify({status: "online"}));
            } catch (e) {
                console.warn("send status online failed", e);
            }
        }
    };

    const connect = (userId) => {
        const uid = getUserIdFromToken() ?? userId ?? currentUser?.id;
        if (!uid || (stompClient && stompClient.connected)) {
            return;
        }
        connectUserIdRef.current = uid;
        const Stomp = require("stompjs");
        let SockJS = require("sockjs-client");
        SockJS = new SockJS("/api/chat/ws");
        stompClient = Stomp.over(SockJS);
        stompClient.connect({userId: uid}, onConnected, onError);
    };

    const onConnected = () => {
        const uid = connectUserIdRef.current ?? currentUser?.id;
        if (!uid) return;
        setIsConnected(true);
        console.log("connected");

        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
        }
        sendStatusOnline();
        heartbeatIntervalRef.current = setInterval(sendStatusOnline, 30000);

        try {
            if (stompClient && stompClient.subscriptions) {
                Object.keys(stompClient.subscriptions).forEach((id) => {
                    stompClient.unsubscribe(id);
                });
            }
        } catch (e) {
            console.warn("failed to cleanup old stomp subscriptions", e);
        }

        stompClient.subscribe(
            "/user/" + uid + "/queue/messages",
            onMessageReceived
        );
        stompClient.subscribe(
            "/user/" + uid + "/queue/read-receipts",
            onReadReceiptReceived
        );
        stompClient.subscribe("/user/" + uid + "/queue/sent-ack", onSentAckReceived);
        stompClient.subscribe("/topic/status", onStatusReceived);
        stompClient.subscribe("/topic/avatar-updated", onAvatarUpdated);

        const pending = pendingMessagesRef.current.splice(0, pendingMessagesRef.current.length);
        pending.forEach((payload) => {
            try {
                stompClient.send("/app/chat", {}, JSON.stringify(payload));
            } catch (e) {
                console.warn("Failed to send pending message", e);
            }
        });
    };

    const onSentAckReceived = (msg) => {
        const saved = typeof msg.body === "string" ? JSON.parse(msg.body) : msg.body;
        if (!saved?.id || saved.senderId !== currentUser?.id) return;
        setMessages((prev) => {
            const idx = prev.findIndex(
                (m) =>
                    m.senderId === currentUser.id &&
                    !m.id &&
                    m.content === saved.content &&
                    Math.abs(new Date(m.timestamp).getTime() - new Date(saved.timestamp).getTime()) < 5000
            );
            if (idx === -1) return prev;
            const tempId = prev[idx]._clientTempId;
            if (tempId && pendingTimeoutsRef.current[tempId]) {
                clearTimeout(pendingTimeoutsRef.current[tempId]);
                delete pendingTimeoutsRef.current[tempId];
            }
            const next = [...prev];
            next[idx] = { ...next[idx], ...saved, id: saved.id, status: saved.status || "RECEIVED" };
            return next;
        });
        setLastMessageByContact((prev) => {
            if (saved.recipientId && prev[saved.recipientId]?.content === saved.content && !prev[saved.recipientId]?.id) {
                return { ...prev, [saved.recipientId]: { ...prev[saved.recipientId], ...saved, id: saved.id, status: saved.status || "RECEIVED" } };
            }
            return prev;
        });
    };

    const onError = (err) => {
        console.warn("STOMP error", err);
        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
        }
        setIsConnected(false);
        stompClient = null;
    };

    const onReadReceiptReceived = (msg) => {
        const data = JSON.parse(msg.body);
        const readerId = data.readerId;
        const recoilPersist = JSON.parse(sessionStorage.getItem("recoil-persist") || "{}");
        const active = recoilPersist.chatActiveContact;
        if (active && active.id === readerId) {
            setMessages((prev) =>
                prev.map((m) =>
                    m.senderId === currentUser.id ? {...m, status: "DELIVERED"} : m
                )
            );
        }
    };

    const onMessageReceived = (msg) => {
        const notification = JSON.parse(msg.body);
        const recoilPersist = JSON.parse(sessionStorage.getItem("recoil-persist") || "{}");
        const active = recoilPersist.chatActiveContact;

        // Если это сообщение, отправленное текущим пользователем,
        // мы уже добавили его оптимистически в sendMessage.
        // Здесь только обновляем контакты/счётчики, чтобы не плодить дубли.
        if (notification.senderId === currentUser.id) {
            loadContacts(active?.id);
            return;
        }

        if (active && active.id === notification.senderId) {
            findChatMessage(notification.id).then((message) => {
                const newMessages = (JSON.parse(sessionStorage.getItem("recoil-persist") || "{}")
                    .chatMessages) || [];
                newMessages.push(message);
                setMessages(newMessages);
                setLastMessageByContact((prev) => ({
                    ...prev,
                    [message.senderId]: message,
                }));
            });
        } else {
            // message.info("Received a new message from " + notification.senderName); TODO для чего тут так?
        }
        loadContacts(active?.id);
    };

    const onStatusReceived = (msg) => {
        let data;
        try {
            data = typeof msg.body === "string" ? JSON.parse(msg.body) : msg.body;
        } catch (e) {
            return;
        }
        if (!data || data.userId == null) return;
        setContacts((prevContacts) =>
            prevContacts.map((contact) =>
                contact.id === data.userId ? { ...contact, status: data.status } : contact
            )
        );
        setActiveContact((prev) =>
            prev && prev.id === data.userId ? { ...prev, status: data.status } : prev
        );
    };

    const onAvatarUpdated = (msg) => {
        let data;
        try {
            data = typeof msg.body === "string" ? JSON.parse(msg.body) : msg.body;
        } catch (e) {
            return;
        }
        if (!data || !data.userId) return;

        setContacts((prevContacts) =>
            prevContacts.map((contact) =>
                contact.id === data.userId ? { ...contact, profilePicture: data.avatarUrl } : contact
            )
        );
        setActiveContact((prev) =>
            prev && prev.id === data.userId ? { ...prev, profilePicture: data.avatarUrl } : prev
        );
        setLoggedInUser((prev) =>
            prev && prev.id === data.userId ? { ...prev, profilePicture: data.avatarUrl } : prev
        );
    };

    const PENDING_FAIL_SEC = 20;

    const sendMessage = (msg) => {
        const trimmed = msg.trim();
        if (!trimmed || !activeContact?.id || !currentUser?.id) {
            return;
        }

        const now = new Date();
        const clientTempId = `temp_${now.getTime()}_${Math.random().toString(36).slice(2)}`;
        const outgoingMessage = {
            senderId: currentUser.id,
            recipientId: activeContact.id,
            senderName: currentUser.name,
            recipientName: activeContact.name,
            content: trimmed,
            timestamp: now,
            status: "PENDING",
            _clientTempId: clientTempId,
        };

        setMessages((prev) => [...prev, outgoingMessage]);
        setLastMessageByContact((prev) => ({ ...prev, [activeContact.id]: outgoingMessage }));
        if (!contacts.some((contact) => contact.id === activeContact.id)) {
            setContacts([activeContact, ...contacts]);
        }

        const payload = {
            senderId: outgoingMessage.senderId,
            recipientId: outgoingMessage.recipientId,
            senderName: outgoingMessage.senderName,
            recipientName: outgoingMessage.recipientName,
            content: outgoingMessage.content,
            timestamp: outgoingMessage.timestamp instanceof Date ? outgoingMessage.timestamp.toISOString() : outgoingMessage.timestamp,
        };
        if (stompClient && stompClient.connected) {
            stompClient.send("/app/chat", {}, JSON.stringify(payload));
        } else {
            pendingMessagesRef.current.push(payload);
            const uid = getUserIdFromToken() ?? currentUser?.id;
            if (uid) connect(uid);
        }

        const timeoutId = setTimeout(() => {
            setMessages((prev) =>
                prev.map((m) =>
                    m._clientTempId === clientTempId ? { ...m, status: "FAILED" } : m
                )
            );
            delete pendingTimeoutsRef.current[clientTempId];
        }, PENDING_FAIL_SEC * 1000);
        pendingTimeoutsRef.current[clientTempId] = timeoutId;
    };

    const getChatId = () => {
        if (!activeContact?.id || !currentUser?.id) return null;
        if (messages.length > 0 && messages[0].chatId) return messages[0].chatId;
        return `${currentUser.id}_${activeContact.id}`;
    };

    const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
    const MAX_IMAGE_SIZE_MB = 10;

    const handleAttachImage = (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file || !activeContact?.id || !currentUser?.id) return;
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            message.warning("Допустимы только JPG, PNG и WebP");
            return;
        }
        if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
            message.warning(`Размер файла не более ${MAX_IMAGE_SIZE_MB} МБ`);
            return;
        }
        const chatId = getChatId();
        if (!chatId) return;
        setImageUploading(true);
        uploadImageMessage(file, chatId)
            .then((saved) => {
                setMessages((prev) => [...prev, { ...saved, status: saved.status || "RECEIVED" }]);
                setLastMessageByContact((prev) => ({ ...prev, [activeContact.id]: saved }));
                if (!contacts.some((c) => c.id === activeContact.id)) {
                    setContacts([activeContact, ...contacts]);
                }
            })
            .catch((err) => {
                const msg = err?.message || err?.error || "Не удалось отправить фото";
                message.error(msg, 3);
            })
            .finally(() => setImageUploading(false));
    };

    // ========================
    // Video circle recording
    // ========================
    const startVideoRecording = async () => {
        if (!activeContact?.id || !currentUser?.id) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode, width: { ideal: 480 }, height: { ideal: 480 } },
                audio: true,
            });
            videoStreamRef.current = stream;
            if (videoPreviewRef.current) {
                videoPreviewRef.current.srcObject = stream;
            }
            const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
                ? "video/webm;codecs=vp9,opus"
                : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
                    ? "video/webm;codecs=vp8,opus"
                    : "video/webm";
            const recorder = new MediaRecorder(stream, { mimeType });
            videoMediaRecorderRef.current = recorder;
            videoChunksRef.current = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) videoChunksRef.current.push(e.data);
            };
            recorder.start(200);
            setIsVideoRecording(true);
            setVideoRecordingTime(0);
            videoTimerRef.current = setInterval(() => {
                setVideoRecordingTime((prev) => prev + 1);
            }, 1000);
        } catch (err) {
            message.error("Не удалось получить доступ к камере");
            console.error("Camera access error:", err);
        }
    };

    const stopVideoRecording = () => {
        const recorder = videoMediaRecorderRef.current;
        if (!recorder || recorder.state === "inactive") return;
        recorder.onstop = () => {
            const blob = new Blob(videoChunksRef.current, { type: "video/webm" });
            sendMediaMessage(blob, "VIDEO_CIRCLE");
            cleanupVideoRecording();
        };
        recorder.stop();
    };

    const cancelVideoRecording = () => {
        const recorder = videoMediaRecorderRef.current;
        if (recorder && recorder.state !== "inactive") {
            recorder.onstop = () => {};
            recorder.stop();
        }
        cleanupVideoRecording();
    };

    const cleanupVideoRecording = () => {
        if (videoTimerRef.current) {
            clearInterval(videoTimerRef.current);
            videoTimerRef.current = null;
        }
        if (videoStreamRef.current) {
            videoStreamRef.current.getTracks().forEach((t) => t.stop());
            videoStreamRef.current = null;
        }
        setIsVideoRecording(false);
        setVideoRecordingTime(0);
        setTorchOn(false);
    };

    const switchCamera = async () => {
        const newMode = facingMode === "user" ? "environment" : "user";
        setFacingMode(newMode);
        if (!isVideoRecording) return;
        // Restart stream with new camera
        if (videoStreamRef.current) {
            videoStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: newMode, width: { ideal: 480 }, height: { ideal: 480 } },
                audio: true,
            });
            videoStreamRef.current = stream;
            if (videoPreviewRef.current) {
                videoPreviewRef.current.srcObject = stream;
            }
        } catch (err) {
            message.error("Не удалось переключить камеру");
        }
    };

    const toggleTorch = async () => {
        if (!videoStreamRef.current) return;
        const track = videoStreamRef.current.getVideoTracks()[0];
        if (!track) return;
        try {
            const capabilities = track.getCapabilities?.();
            if (!capabilities?.torch) {
                message.warning("Фонарик не поддерживается на этом устройстве");
                return;
            }
            const newVal = !torchOn;
            await track.applyConstraints({ advanced: [{ torch: newVal }] });
            setTorchOn(newVal);
        } catch (err) {
            message.warning("Не удалось переключить фонарик");
        }
    };

    // ========================
    // Voice recording
    // ========================
    const startVoiceRecording = async () => {
        if (!activeContact?.id || !currentUser?.id) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            voiceStreamRef.current = stream;
            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : "audio/webm";
            const recorder = new MediaRecorder(stream, { mimeType });
            voiceMediaRecorderRef.current = recorder;
            voiceChunksRef.current = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) voiceChunksRef.current.push(e.data);
            };
            recorder.start(200);
            setIsVoiceRecording(true);
            setVoiceRecordingTime(0);
            voiceTimerRef.current = setInterval(() => {
                setVoiceRecordingTime((prev) => prev + 1);
            }, 1000);
        } catch (err) {
            message.error("Не удалось получить доступ к микрофону");
            console.error("Microphone access error:", err);
        }
    };

    const stopVoiceRecording = () => {
        const recorder = voiceMediaRecorderRef.current;
        if (!recorder || recorder.state === "inactive") return;
        recorder.onstop = () => {
            const blob = new Blob(voiceChunksRef.current, { type: "audio/webm" });
            sendMediaMessage(blob, "VOICE");
            cleanupVoiceRecording();
        };
        recorder.stop();
    };

    const cancelVoiceRecording = () => {
        const recorder = voiceMediaRecorderRef.current;
        if (recorder && recorder.state !== "inactive") {
            recorder.onstop = () => {};
            recorder.stop();
        }
        cleanupVoiceRecording();
    };

    const cleanupVoiceRecording = () => {
        if (voiceTimerRef.current) {
            clearInterval(voiceTimerRef.current);
            voiceTimerRef.current = null;
        }
        if (voiceStreamRef.current) {
            voiceStreamRef.current.getTracks().forEach((t) => t.stop());
            voiceStreamRef.current = null;
        }
        setIsVoiceRecording(false);
        setVoiceRecordingTime(0);
    };

    // ========================
    // Send media (video/voice) helper
    // ========================
    const sendMediaMessage = (blob, mediaType) => {
        const chatId = getChatId();
        if (!chatId || !activeContact?.id || !currentUser?.id) return;
        const file = new File([blob], mediaType === "VIDEO_CIRCLE" ? "video.webm" : "voice.webm", { type: blob.type });
        const setUploading = mediaType === "VIDEO_CIRCLE" ? setVideoUploading : setVoiceUploading;
        setUploading(true);
        uploadMedia(file, chatId, currentUser.id, activeContact.id, mediaType)
            .then((saved) => {
                setMessages((prev) => [...prev, { ...saved, status: saved.status || "RECEIVED" }]);
                setLastMessageByContact((prev) => ({ ...prev, [activeContact.id]: saved }));
                if (!contacts.some((c) => c.id === activeContact.id)) {
                    setContacts([activeContact, ...contacts]);
                }
            })
            .catch((err) => {
                const errMsg = err?.message || err?.error || "Не удалось отправить медиа";
                message.error(errMsg, 3);
            })
            .finally(() => setUploading(false));
    };

    const formatRecordingTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, "0");
        const s = (seconds % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    };

    const normalizeText = (value = "") =>
        value
            .toLowerCase()
            .replace(/^@/, "")
            .replace(/[^a-z0-9а-яё]/gi, "");

    const levenshtein = (a, b) => {
        if (a === b) return 0;
        if (!a) return b.length;
        if (!b) return a.length;

        const matrix = Array.from({length: a.length + 1}, () => []);

        for (let i = 0; i <= a.length; i += 1) {
            matrix[i][0] = i;
        }
        for (let j = 0; j <= b.length; j += 1) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= a.length; i += 1) {
            for (let j = 1; j <= b.length; j += 1) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }

        return matrix[a.length][b.length];
    };

    const isFuzzyMatch = (query, value) => {
        const normalizedQuery = normalizeText(query);
        const normalizedValue = normalizeText(value);

        if (!normalizedQuery) return true;
        if (!normalizedValue) return false;
        if (normalizedValue.includes(normalizedQuery)) return true;

        const distance = levenshtein(normalizedQuery, normalizedValue);
        const length = normalizedQuery.length;

        const maxDistance = length <= 4 ? 1 : length <= 8 ? 2 : 3;
        return distance <= maxDistance;
    };

    const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

    const renderMessageText = (content = "") => {
        if (!content) return null;

        const parts = content.split(linkRegex);
        return parts.map((part, index) => {
            if (!part) return null;
            linkRegex.lastIndex = 0;
            const isLink = linkRegex.test(part);
            linkRegex.lastIndex = 0;

            if (!isLink) {
                return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>;
            }

            const href = part.startsWith("http") ? part : `https://${part}`;
            return (
                <a
                    key={`link-${index}`}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="message-link"
                >
                    {part}
                </a>
            );
        });
    };

    const filteredContacts = contacts.filter((contact) =>
        isFuzzyMatch(searchQuery, contact.username || contact.name)
    );

    const loadChatForContact = (contact) => {
        if (!contact?.id) return;
        setMessages([]);
        setMessagesPage(0);
        setHasMoreMessages(true);
        getChatMessagesPage(contact.id, currentUser.id, 0, 50)
            .then((data) => {
                const items = data?.items || [];
                const ordered = [...items].reverse();
                setMessages(ordered);
                setHasMoreMessages(Boolean(data?.hasMore));
                setMessagesPage(data?.nextPage != null ? data.nextPage : 0);
                if (items.length > 0) {
                    setLastMessageByContact((prev) => ({
                        ...prev,
                        [contact.id]: items[0],
                    }));
                }
                setContacts((prev) =>
                    prev.map((c) => (c.id === contact.id ? {...c, newMessages: 0} : c))
                );
            });
    };

    const loadMoreMessages = () => {
        if (!activeContact?.id || !currentUser?.id || !hasMoreMessages || messagesLoadingOlder) return;
        const container = messagesContainerRef.current;
        if (!container) return;
        const scrollHeight = container.scrollHeight;
        const scrollTop = container.scrollTop;
        scrollRestoreRef.current = { scrollHeight, scrollTop };
        setMessagesLoadingOlder(true);
        getChatMessagesPage(activeContact.id, currentUser.id, messagesPage, 50)
            .then((data) => {
                const items = data?.items || [];
                if (items.length === 0) {
                    setHasMoreMessages(false);
                    return;
                }
                const ordered = [...items].reverse();
                setMessages((prev) => [...ordered, ...prev]);
                setHasMoreMessages(Boolean(data?.hasMore));
                setMessagesPage(data?.nextPage != null ? data.nextPage : messagesPage + 1);
            })
            .finally(() => setMessagesLoadingOlder(false));
    };

    const loadContactProfile = (contact) => {
        if (!contact?.username) return;
        setProfileData(null);
        setProfileLoading(true);
        getUserSummary(contact.username)
            .then((data) => setProfileData(data))
            .catch(() => setProfileData(contact))
            .finally(() => setProfileLoading(false));
    };

    const loadContacts = (forceContactId, userIdForApi) => {
        const uid = getUserIdFromToken() ?? userIdForApi ?? currentUser?.id;
        if (!uid) return;
        Promise.all([
            getUsers(),
            getChatContacts(uid),
            getUnreadCounts(uid),
            getStatuses(uid),
        ])
            .then(([users, contactIds, unreadCounts, statuses]) => {
                const idsWithForce = forceContactId && !contactIds.includes(forceContactId)
                    ? [...contactIds, forceContactId]
                    : contactIds;
                const contactsWithHistory = users.filter((contact) =>
                    contact.id !== uid && idsWithForce.includes(contact.id)
                );

                setAllUsers(users.filter((contact) => contact.id !== uid));

                return Promise.all(
                    contactsWithHistory.map((contact) =>
                        getChatMessagesPage(contact.id, uid, 0, 1).then((data) => {
                            const lastMessage = data?.items?.length > 0 ? data.items[0] : null;
                            const newMessages = Number(unreadCounts[contact.id]) || 0;
                            const status = statuses && statuses[contact.id] ? statuses[contact.id] : "offline";
                            return {
                                ...contact,
                                newMessages,
                                lastMessage,
                                status,
                            };
                        })
                    )
                );
            })
            .then((users) => {
                const lastMessagesMap = users.reduce((acc, contact) => {
                    if (contact.lastMessage) {
                        acc[contact.id] = contact.lastMessage;
                    }
                    return acc;
                }, {});

                setLastMessageByContact((prev) => {
                    const merged = {...prev};
                    Object.keys(lastMessagesMap).forEach((contactId) => {
                        const serverMsg = lastMessagesMap[contactId];
                        const localMsg = prev[contactId];
                        if (!localMsg) {
                            merged[contactId] = serverMsg;
                        } else {
                            const serverTime = new Date(serverMsg.timestamp).getTime();
                            const localTime = new Date(localMsg.timestamp).getTime();
                            merged[contactId] = serverTime >= localTime ? serverMsg : localMsg;
                        }
                    });
                    return merged;
                });

                const sorted = [...users].sort((a, b) => {
                    const aMsg = a.lastMessage || lastMessagesMap[a.id];
                    const bMsg = b.lastMessage || lastMessagesMap[b.id];
                    if (!aMsg && !bMsg) return 0;
                    if (!aMsg) return 1;
                    if (!bMsg) return -1;
                    return new Date(bMsg.timestamp).getTime() - new Date(aMsg.timestamp).getTime();
                });
                setContacts(sorted);
                const activeIdToCheck = forceContactId ?? activeContact?.id;
                const activeInList = sorted.find((contact) => contact.id === activeIdToCheck);
                if (!activeInList && users.length > 0 && !forceContactId) {
                    setActiveContact(null);
                }
            });
    };

    const closeChat = () => {
        setActiveContact(null);
        setMessages([]);
    };

    const goToProfile = () => {
        try {
            sessionStorage.setItem("profileBack", "/chat");
        } catch (error) {
        }
        props.history.push("/profile");
    };

    const goToSettings = () => {
        props.history.push("/settings");
    };

    const logout = () => {
        try {
            const persisted = sessionStorage.getItem("recoil-persist");
            if (persisted) {
                const data = JSON.parse(persisted);
                delete data.chatActiveContact;
                delete data.chatMessages;
                delete data.loggedInUser;
                sessionStorage.setItem("recoil-persist", JSON.stringify(data));
            }
        } catch (e) {
            sessionStorage.removeItem("recoil-persist");
        }
        localStorage.removeItem("accessToken");
        props.history.push("/login");
    };

    const formatTime = (isoDate) => {
        if (!isoDate) return "";
        const date = new Date(isoDate);
        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatDate = (isoDate) => {
        const date = new Date(isoDate);
        return date.toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
        });
    };

    const deleteChat = (contactId) => {
        setContacts((prev) => prev.filter((contact) => contact.id !== contactId));
        setLastMessageByContact((prev) => {
            const next = {...prev};
            delete next[contactId];
            return next;
        });
        if (activeContact?.id === contactId) {
            closeChat();
        }
    };

    const openDeleteChat = (contact) => {
        setDeleteChatTarget(contact);
        setIsDeleteChatOpen(true);
    };

    const closeDeleteChat = () => {
        setIsDeleteChatOpen(false);
        setDeleteChatTarget(null);
    };

    const handleDeleteChat = (scope) => {
        if (!deleteChatTarget) return;
        setDeleteChatLoading(true);
        deleteChatRequest(currentUser.id, deleteChatTarget.id, currentUser.id, scope)
            .then(() => deleteChat(deleteChatTarget.id))
            .catch(() => deleteChat(deleteChatTarget.id))
            .finally(() => {
                setDeleteChatLoading(false);
                closeDeleteChat();
                setIsProfileOpen(false);
            });
    };

    const onContactsRefresh = () => {
        const uid = getUserIdFromToken() ?? currentUser?.id;
        if (uid && (!stompClient || !stompClient.connected)) {
            connect(uid);
        }
        loadContacts(undefined, uid);
    };

    const {scrollRef: contactsScrollRef, pullDistance, isRefreshing: isContactsRefreshing, isPullGestureRef} =
        usePullToRefresh({onRefresh: onContactsRefresh, threshold: 60});

    const isNewDay = (current, previous) => {
        if (!previous) return true;
        const currDate = new Date(current).toDateString();
        const prevDate = new Date(previous).toDateString();
        return currDate !== prevDate;
    };

    const handleMessagesScroll = () => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const distanceFromBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight;

        // Считаем, что пользователь "у низа", если он ближе 64px к концу.
        setIsUserNearBottom(distanceFromBottom < 64);

        // Подгрузка старых сообщений при скролле вверх.
        if (container.scrollTop < 80 && hasMoreMessages && !messagesLoadingOlder) {
            loadMoreMessages();
        }
    };

    const openContextMenu = (e, position, messageContent) => {
        // Используем переданную позицию или получаем из события
        const pos = position || (() => {
            const touch = e.touches?.[0] || e.changedTouches?.[0];
            return touch
                ? {x: touch.clientX, y: touch.clientY}
                : {x: e.clientX || 0, y: e.clientY || 0};
        })();

        setContextMenu({
            visible: true,
            position: pos,
            messageContent,
        });
    };

    const closeContextMenu = () => {
        setContextMenu((prev) => ({...prev, visible: false}));
    };

    const handleCopyMessage = async (messageContent) => {
        try {
            await copyToClipboard(messageContent);
            message.success("Сообщение скопировано", 2);
        } catch (error) {
            console.error("Failed to copy message:", error);
            message.error("Не удалось скопировать сообщение", 2);
        }
    };

    const isMobileChatOpen = isMobile && !!activeContact;

    const handlePhotosScroll = () => {
        const el = photosScrollRef.current;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distanceFromBottom < 64) {
            loadChatImages(false);
        }
    };

    const openPhotoViewer = (index) => {
        if (index < 0 || index >= photos.length) return;
        setActivePhotoIndex(index);
        setIsPhotoViewerOpen(true);
    };

    const showPrevPhoto = () => {
        setActivePhotoIndex((prev) => (prev > 0 ? prev - 1 : prev));
    };

    const showNextPhoto = () => {
        setActivePhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : prev));
    };

    return (
        <div id="frame" className={isMobileChatOpen ? "chat-open" : ""}>
            <div id="sidepanel">
                <div id="profile">
                    <div className="wrap">
                        <div
                            className={`avatar-wrapper ${currentUser.status || "online"}`}
                            onClick={() => {
                                if (currentUser.profilePicture) {
                                    setIsAvatarViewerOpen(true);
                                } else {
                                    goToSettings();
                                }
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    if (currentUser.profilePicture) {
                                        setIsAvatarViewerOpen(true);
                                    } else {
                                        goToSettings();
                                    }
                                }
                            }}
                        >
                            <Avatar
                                name={currentUser.name}
                                src={currentUser.profilePicture}
                                size={50}
                            />
                        </div>
                        <p onClick={goToSettings} role="button" tabIndex={0}>
                            {currentUser.name || currentUser.username || "Профиль"}
                        </p>
                        {!isConnected && (
                            <span className="connection-label" aria-label="Нет соединения">
                                Нет соединения
                            </span>
                        )}
                    </div>
                </div>
                <div
                    id="search"
                    onClick={() => document.getElementById("contact-search")?.focus()}
                >
                    <label htmlFor="contact-search">
                        <i className="fa fa-search" aria-hidden="true"></i>
                    </label>
                    <input
                        id="contact-search"
                        type="text"
                        placeholder={isSearchFocused ? "Поиск по имени пользователя" : "Поиск"}
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => setIsSearchFocused(false)}
                    />
                </div>
                {searchQuery.trim() && (
                    <div className="search-results">
                        <div className="search-results-title">Результаты поиска</div>
                        <ul>
                            {searchLoading ? (
                                <li className="search-result-empty">Загрузка…</li>
                            ) : searchResults.length > 0 ? (
                                searchResults.map((user) => (
                                    <li
                                        key={user.id}
                                        className="search-result-item"
                                        onClick={() => {
                                            setActiveContact(user);
                                            setSearchQuery("");
                                            setSearchResults([]);
                                            setContacts((prev) =>
                                                prev.some((c) => c.id === user.id)
                                                    ? prev
                                                    : [user, ...prev]
                                            );
                                        }}
                                    >
                                        <div className="avatar-wrapper">
                                            <Avatar
                                                name={user.name}
                                                src={user.profilePicture}
                                                size={36}
                                            />
                                        </div>
                                        <div className="search-result-meta">
                                            <p className="name">{user.name}</p>
                                            <p className="username">@{user.username}</p>
                                        </div>
                                    </li>
                                ))
                            ) : (
                                <li className="search-result-empty">Ничего не найдено</li>
                            )}
                        </ul>
                    </div>
                )}
                <div
                    id="contacts"
                    className="contacts-list"
                    ref={contactsScrollRef}
                >
                    <div
                        className="contacts-pull-indicator"
                        style={{height: pullDistance || (isContactsRefreshing ? 52 : 0)}}
                        aria-hidden={!pullDistance && !isContactsRefreshing}
                    >
                        {isContactsRefreshing ? (
                            <span className="contacts-pull-spinner"/>
                        ) : pullDistance > 0 ? (
                            <span className="contacts-pull-text">
                                {pullDistance >= 60 ? "Отпустите для обновления" : "Потяните для обновления"}
                            </span>
                        ) : null}
                    </div>
                    <ul>
                        {filteredContacts.map((contact) => (
                            <li
                                key={contact.id}
                                onClick={() => {
                                    if (activeContact?.id !== contact.id) {
                                        setActiveContact(contact);
                                    } else {
                                        loadChatForContact(contact);
                                    }
                                }}
                                className={
                                    activeContact && contact.id === activeContact.id
                                        ? "contact active"
                                        : "contact"
                                }
                            >
                                <div className="wrap">
                                    <div className={`avatar-wrapper ${contact.status}`}>
                                        <Avatar
                                            name={contact.name}
                                            src={contact.profilePicture}
                                            size={44}
                                        />
                                    </div>
                                    <div className="meta">
                                        <div className="meta-header">
                                            <p className="name">{contact.name}</p>
                                            <span className="meta-right">
                                                {lastMessageByContact[contact.id]?.timestamp && (
                                                    <span className="last-time">
                                                        {formatLastMessageDate(lastMessageByContact[contact.id].timestamp)}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        <p className="preview">
                                            {lastMessageByContact[contact.id]
                                                ? (lastMessageByContact[contact.id].messageType === "IMAGE"
                                                    ? "[Фото]"
                                                    : lastMessageByContact[contact.id].messageType === "VIDEO_CIRCLE"
                                                        ? "🔵 Видеосообщение"
                                                        : lastMessageByContact[contact.id].messageType === "VOICE"
                                                            ? "🎤 Голосовое"
                                                            : lastMessageByContact[contact.id].content ?? "")
                                                : "Нет сообщений"}
                                        </p>
                                        <span className="meta-badge-cell">
                                            {contact.newMessages > 0 && (
                                                <span className="unread-badge"
                                                      aria-label={`Непрочитанных: ${contact.newMessages}`}>
                                                    {contact.newMessages > 99 ? "99+" : contact.newMessages}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
                <div id="bottom-bar">
                    {/*<button id="addcontact">*/}
                    {/*  <i class="fa fa-user fa-fw" aria-hidden="true"></i>{" "}*/}
                    {/*  <span>Profile</span>*/}
                    {/*</button>*/}

                    <button
                        id="addcontact"
                        onClick={() => props.history.push("/profile")}>
                        <i className="fa fa-user fa-fw" aria-hidden="true"></i>{" "}
                        <span>Профиль</span>
                    </button>
                    <button
                        id="settings"
                        onClick={() => props.history.push("/settings")}
                    >
                        <i className="fa fa-cog fa-fw" aria-hidden="true"></i>{" "}
                        <span>Настройки</span>
                    </button>
                </div>
            </div>
            <div className="content">
                {activeContact ? (
                    <>
                        <div className="contact-profile">
                            <button className="back-btn" onClick={() => setActiveContact(null)}>
                                ←
                            </button>
                            <button
                                type="button"
                                className="contact-profile-trigger"
                                onClick={() => setIsProfileOpen(true)}
                            >
                                <div className={`avatar-wrapper ${activeContact.status || "offline"}`}>
                                    <Avatar
                                        name={activeContact.name}
                                        src={activeContact.profilePicture}
                                        size={44}
                                    />
                                </div>
                                <span className="contact-profile-name">{activeContact.name}</span>
                            </button>
                            <button
                                type="button"
                                className="close-chat-btn"
                                onClick={closeChat}
                                aria-label="Закрыть чат"
                            >
                                ×
                            </button>
                        </div>

                        <div
                            key={activeContact.id}
                            className="messages"
                            ref={messagesContainerRef}
                            onScroll={handleMessagesScroll}
                        >
                            {messagesLoadingOlder && (
                                <div className="messages-loading-older">
                                    <Spin size="small" />
                                </div>
                            )}
                            <ul ref={messagesListRef}>
                                {messages.map((msg, index) => {
                                    const showDate = isNewDay(msg.timestamp, messages[index - 1]?.timestamp);

                                    return (
                                        <React.Fragment
                                            key={msg.id || `${msg.senderId}-${msg.timestamp}-${index}`}
                                        >
                                            {showDate && (
                                                <li className="date-separator">
                                                    <span>{formatDate(msg.timestamp)}</span>
                                                </li>
                                            )}

                                            <li className={msg.senderId === currentUser.id ? "sent" : "replies"}>
                                                <MessageBubble
                                                    content={msg.content}
                                                    timestamp={msg.timestamp}
                                                    onLongPress={(e, position) => openContextMenu(e, position, msg.content)}
                                                    isPullGestureRef={isPullGestureRef}
                                                    renderMessageText={renderMessageText}
                                                    formatTime={formatTime}
                                                    isOwn={msg.senderId === currentUser.id}
                                                    status={msg.status}
                                                    messageType={msg.messageType || "TEXT"}
                                                    imageUrl={msg.imageUrl}
                                                    messageId={msg.id}
                                                    onImageLoad={scrollMessagesToBottomIfNear}
                                                />
                                            </li>
                                        </React.Fragment>
                                    );
                                })}
                            </ul>
                        </div>

                        <div className="message-input">
                            <div className="wrap">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="message-input-file"
                                    aria-label="Прикрепить фото"
                                    onChange={handleAttachImage}
                                />
                                <button
                                    type="button"
                                    className="attachment"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={imageUploading}
                                    aria-label="Прикрепить фото"
                                    title="Прикрепить фото"
                                >
                                    {imageUploading ? (
                                        <Spin size="small" className="attachment-spinner" />
                                    ) : (
                                        <i className="fa fa-paperclip" aria-hidden="true" />
                                    )}
                                </button>

                                {isVoiceRecording ? (
                                    <div className="voice-recording-bar">
                                        <span className="voice-rec-indicator">●</span>
                                        <span className="voice-rec-time">{formatRecordingTime(voiceRecordingTime)}</span>
                                        <button type="button" className="voice-rec-cancel" onClick={cancelVoiceRecording} title="Отменить">✕</button>
                                        <button type="button" className="voice-rec-send" onClick={stopVoiceRecording} title="Отправить">
                                            <i className="fa fa-paper-plane" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <input
                                            className="chat-input"
                                            name="user_input"
                                            placeholder="Напишите сообщение..."
                                            value={text}
                                            onChange={(event) => setText(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    sendMessage(text);
                                                    setText("");
                                                }
                                            }}
                                        />

                                        {!text.trim() && (
                                            <>
                                                <button
                                                    type="button"
                                                    className="media-btn voice-btn"
                                                    onClick={startVoiceRecording}
                                                    disabled={voiceUploading}
                                                    title="Голосовое сообщение"
                                                >
                                                    {voiceUploading ? (
                                                        <Spin size="small" />
                                                    ) : (
                                                        <i className="fa fa-microphone" />
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="media-btn video-btn"
                                                    onClick={startVideoRecording}
                                                    disabled={videoUploading}
                                                    title="Видеосообщение"
                                                >
                                                    {videoUploading ? (
                                                        <Spin size="small" />
                                                    ) : (
                                                        <i className="fa fa-video-camera" />
                                                    )}
                                                </button>
                                            </>
                                        )}

                                        {text.trim() && (
                                            <Button
                                                className="send-btn"
                                                icon={<i className="fa fa-paper-plane"/>}
                                                onClick={() => {
                                                    sendMessage(text);
                                                    setText("");
                                                }}
                                            />
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Video recording overlay */}
                        {isVideoRecording && (
                            <div className="video-recording-overlay">
                                <video
                                    ref={videoPreviewRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="video-recording-preview"
                                />
                                <div className="video-recording-controls">
                                    <span className="video-rec-time">● {formatRecordingTime(videoRecordingTime)}</span>
                                    <div className="video-rec-buttons">
                                        <button type="button" className="video-rec-torch" onClick={toggleTorch} title="Фонарик">
                                            <i className={`fa fa-bolt ${torchOn ? "torch-on" : ""}`} />
                                        </button>
                                        <button type="button" className="video-rec-switch" onClick={switchCamera} title="Переключить камеру">
                                            <i className="fa fa-refresh" />
                                        </button>
                                        <button type="button" className="video-rec-cancel" onClick={cancelVideoRecording} title="Отменить">✕</button>
                                        <button type="button" className="video-rec-send" onClick={stopVideoRecording} title="Отправить">
                                            <i className="fa fa-paper-plane" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="no-contact-selected">
                        <p>Выберите контакт для отправки сообщений</p>
                    </div>
                )}
            </div>

            <Drawer
                title="Профиль собеседника"
                placement="right"
                onClose={() => setIsProfileOpen(false)}
                visible={isProfileOpen}
                destroyOnClose
                className="contact-profile-drawer"
            >
                {profileLoading ? (
                    <div className="contact-profile-loading">
                        <Spin/>
                    </div>
                ) : (
                    <div className="contact-profile-card">
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                                if (profileData?.profilePicture || activeContact?.profilePicture) {
                                    setIsContactAvatarViewerOpen(true);
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && (profileData?.profilePicture || activeContact?.profilePicture)) {
                                    setIsContactAvatarViewerOpen(true);
                                }
                            }}
                        >
                            <Avatar
                                name={profileData?.name || activeContact?.name}
                                src={profileData?.profilePicture || activeContact?.profilePicture}
                                size={96}
                            />
                        </div>
                        <div className="contact-profile-title">
                            {profileData?.name || activeContact?.name}
                        </div>
                        <div className="contact-profile-username">
                            @{profileData?.username || activeContact?.username}
                        </div>
                        {activeContact?.status && (
                            <div className={`contact-profile-status ${activeContact.status}`}>
                                {activeContact.status === "online" && "В сети"}
                                {activeContact.status === "away" && "Нет на месте"}
                                {activeContact.status === "busy" && "Занят"}
                                {activeContact.status === "offline" && "Оффлайн"}
                            </div>
                        )}
                        <Button
                            danger
                            type="primary"
                            className="delete-chat-btn"
                            onClick={() => openDeleteChat(activeContact)}
                        >
                            Удалить чат
                        </Button>

                        <div className="contact-photos-section">
                            <div
                                className="contact-photos-tab"
                                ref={photosScrollRef}
                                onScroll={handlePhotosScroll}
                            >
                                {photosLoading && photos.length === 0 && (
                                    <div className="contact-profile-loading">
                                        <Spin/>
                                    </div>
                                )}
                                {photosError && (
                                    <div className="contact-profile-error">
                                        {photosError}
                                        <Button type="link" onClick={() => loadChatImages(true)}>
                                            Повторить
                                        </Button>
                                    </div>
                                )}
                                {!photosLoading && !photosError && photos.length === 0 && (
                                    <div className="contact-profile-empty">
                                        Нет фотографий
                                    </div>
                                )}
                                {photos.length > 0 && (
                                    <>
                                        <div className="photos-grid">
                                            {photos.map((msg, index) => (
                                                <PhotoGridImage
                                                    key={msg.id || `${msg.chatId}-${msg.timestamp}-${index}`}
                                                    messageId={msg.id}
                                                    onClick={() => openPhotoViewer(index)}
                                                />
                                            ))}
                                        </div>
                                        {photosLoading && photos.length > 0 && (
                                            <div className="photos-grid-loading-more">
                                                <Spin size="small"/>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Drawer>

            <Modal
                title="Удалить чат"
                open={isDeleteChatOpen}
                zIndex={1100}
                onCancel={() => {
                    closeDeleteChat();
                    setIsProfileOpen(false);
                }}
                footer={[
                    <Button
                        key="cancel"
                        onClick={() => {
                            closeDeleteChat();
                            setIsProfileOpen(false);
                        }}
                    >
                        Отменить
                    </Button>,
                    <Button
                        key="delete-me"
                        onClick={() => handleDeleteChat("me")}
                        loading={deleteChatLoading}
                    >
                        Удалить чат у себя
                    </Button>,
                    <Button
                        key="delete-all"
                        danger
                        type="primary"
                        onClick={() => handleDeleteChat("all")}
                        loading={deleteChatLoading}
                    >
                        Удалить чат у обоих
                    </Button>,
                ]}
            >
                <div>
                    Переписка с пользователем будет удалена выбранным способом.
                </div>
            </Modal>

            <Drawer
                title="Меню"
                placement="left"
                onClose={() => setIsMenuOpen(false)}
                visible={isMenuOpen}
                className="chat-menu-drawer"
            >
                <div className="chat-menu-section">
                    <Button type="text" onClick={goToProfile} className="chat-menu-item">
                        Мой профиль
                    </Button>
                    <Button type="text" onClick={goToSettings} className="chat-menu-item">
                        Настройки
                    </Button>
                    <Button type="text" danger onClick={logout} className="chat-menu-item">
                        Выйти
                    </Button>
                </div>
            </Drawer>

            <div className="mobile-bottom-nav">
                <button
                    type="button"
                    className={`mobile-nav-item ${!isMobileChatOpen ? "active" : ""}`}
                    onClick={() => props.history.push("/chat")}
                >
                    <i className="fa fa-comments" aria-hidden="true"></i>
                    <span>Чаты</span>
                </button>
                <button
                    type="button"
                    className="mobile-nav-item"
                    onClick={() => props.history.push("/settings")}
                >
                    <i className="fa fa-cog" aria-hidden="true"></i>
                    <span>Настройки</span>
                </button>
            </div>

            <MessageContextMenu
                visible={contextMenu.visible}
                position={contextMenu.position}
                onClose={closeContextMenu}
                onCopy={handleCopyMessage}
                messageContent={contextMenu.messageContent}
            />

            <Modal
                open={isPhotoViewerOpen}
                footer={null}
                onCancel={() => setIsPhotoViewerOpen(false)}
                width="80%"
                className="photo-viewer-modal"
                centered
            >
                {photos.length > 0 && photos[activePhotoIndex] && (
                    <div className="photo-viewer-content">
                        <button
                            type="button"
                            className="photo-viewer-nav photo-viewer-prev"
                            onClick={showPrevPhoto}
                            disabled={activePhotoIndex === 0}
                        >
                            ‹
                        </button>
                        {viewerBlobUrl ? (
                            <img
                                src={viewerBlobUrl}
                                alt="Фото из чата"
                                className="photo-viewer-image"
                            />
                        ) : (
                            <div className="photo-viewer-loading"><Spin /></div>
                        )}
                        <button
                            type="button"
                            className="photo-viewer-nav photo-viewer-next"
                            onClick={showNextPhoto}
                            disabled={activePhotoIndex === photos.length - 1}
                        >
                            ›
                        </button>
                    </div>
                )}
            </Modal>

            <Modal
                open={isContactAvatarViewerOpen}
                footer={null}
                onCancel={() => setIsContactAvatarViewerOpen(false)}
                width="80%"
                className="photo-viewer-modal"
                centered
            >
                {(profileData?.profilePicture || activeContact?.profilePicture) && (
                    <img
                        src={profileData?.profilePicture || activeContact?.profilePicture}
                        alt={profileData?.name || activeContact?.name || activeContact?.username || "Аватар"}
                        className="photo-viewer-image"
                    />
                )}
            </Modal>

            <Modal
                open={isAvatarViewerOpen}
                footer={null}
                onCancel={() => setIsAvatarViewerOpen(false)}
                width="80%"
                className="photo-viewer-modal"
                centered
            >
                {currentUser.profilePicture ? (
                    <img
                        src={currentUser.profilePicture}
                        alt={currentUser.name || currentUser.username || "Аватар"}
                        className="photo-viewer-image"
                    />
                ) : null}
            </Modal>
        </div>
    );
};

export default Chat;
