import React, {useEffect, useLayoutEffect, useRef, useState} from "react";
import {Button, Drawer, message, Spin, Modal} from "antd";
import {
    getUsers,
    findChatMessages,
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
    const heartbeatIntervalRef = useRef(null);
    const connectUserIdRef = useRef(null);
    const [isUserNearBottom, setIsUserNearBottom] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const [contextMenu, setContextMenu] = useState({
        visible: false,
        position: {x: 0, y: 0},
        messageContent: "",
    });
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
            if (document.visibilityState === "visible" && stompClient && stompClient.connected) {
                sendStatusOnline();
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
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
        if (!activeContact?.username) return;
        loadContactProfile(activeContact);
    }, [activeContact?.username]);

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
        console.log("connected");
        setIsConnected(true);

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
        stompClient.subscribe("/topic/status", onStatusReceived);
    };

    const onError = (err) => {
        console.warn("STOMP error", err);
        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
        }
        setIsConnected(false);
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

    const sendMessage = (msg) => {
        const trimmed = msg.trim();
        if (!trimmed || !activeContact?.id || !currentUser?.id) {
            return;
        }

        const message = {
            senderId: currentUser.id,
            recipientId: activeContact.id,
            senderName: currentUser.name,
            recipientName: activeContact.name,
            content: trimmed,
            timestamp: new Date(),
            status: "RECEIVED",
        };

        // Оптимистически добавляем сообщение отправителю,
        // чтобы оно сразу появилось в чате.
        const newMessages = [...messages, message];
        setMessages(newMessages);
        setLastMessageByContact((prev) => ({
            ...prev,
            [activeContact.id]: message,
        }));
        if (!contacts.some((contact) => contact.id === activeContact.id)) {
            setContacts([activeContact, ...contacts]);
        }

        if (stompClient && stompClient.connected) {
            stompClient.send("/app/chat", {}, JSON.stringify(message));
        }
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
        findChatMessages(contact.id, currentUser.id)
            .then((items) => {
                setMessages(items);
                if (items.length > 0) {
                    setLastMessageByContact((prev) => ({
                        ...prev,
                        [contact.id]: items[items.length - 1],
                    }));
                }
                setContacts((prev) =>
                    prev.map((c) => (c.id === contact.id ? {...c, newMessages: 0} : c))
                );
            });
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
                        findChatMessages(contact.id, uid).then((msgs) => {
                            const lastMessage = msgs.length > 0 ? msgs[msgs.length - 1] : null;
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
        props.history.push("/");
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

    const {scrollRef: contactsScrollRef, pullDistance, isRefreshing: isContactsRefreshing, isPullGestureRef} =
        usePullToRefresh({onRefresh: loadContacts, threshold: 60});

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

    return (
        <div id="frame" className={isMobileChatOpen ? "chat-open" : ""}>
            <div id="sidepanel">
                <div id="profile">
                    <div className="wrap">
                        <div
                            className={`avatar-wrapper ${currentUser.status || "online"}`}
                            onClick={goToSettings}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => event.key === "Enter" && goToSettings()}
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
                                            {lastMessageByContact[contact.id]?.content
                                                ? lastMessageByContact[contact.id].content
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
                        onClick={() => props.history.push("/")}>
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
                            <ul>
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
                                                {msg.senderId !== currentUser.id && (
                                                    <Avatar
                                                        name={activeContact.name}
                                                        src={activeContact.profilePicture}
                                                        size={28}
                                                    />
                                                )}

                                                <MessageBubble
                                                    content={msg.content}
                                                    timestamp={msg.timestamp}
                                                    onLongPress={(e, position) => openContextMenu(e, position, msg.content)}
                                                    isPullGestureRef={isPullGestureRef}
                                                    renderMessageText={renderMessageText}
                                                    formatTime={formatTime}
                                                    isOwn={msg.senderId === currentUser.id}
                                                    status={msg.status}
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

                                <Button
                                    className="send-btn"
                                    icon={<i className="fa fa-paper-plane"/>}
                                    onClick={() => {
                                        sendMessage(text);
                                        setText("");
                                    }}
                                />
                            </div>
                        </div>
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
                        <Avatar
                            name={profileData?.name || activeContact?.name}
                            src={profileData?.profilePicture || activeContact?.profilePicture}
                            size={96}
                        />
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
        </div>
    );
};

export default Chat;
