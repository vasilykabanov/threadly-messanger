import React, {useEffect, useState} from "react";
import {Button, Drawer, message, Spin} from "antd";
import {
    getUsers,
    countNewMessages,
    findChatMessages,
    findChatMessage,
    getUserSummary,
    getChatContacts,
    getCurrentUser,
    ensurePushSubscribed,
} from "../util/ApiUtil";
import {useRecoilState} from "recoil";
import {
    loggedInUser,
    chatActiveContact,
    chatMessages,
} from "../atom/globalState";
import ScrollToBottom from "react-scroll-to-bottom";
import "./Chat.css";
import Avatar from "../profile/Avatar";

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
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileData, setProfileData] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (localStorage.getItem("accessToken") === null) {
            props.history.push("/login");
        }
        if (!currentUser?.id) {
            getCurrentUser()
                .then((response) => setLoggedInUser(response))
                .catch(() => {});
        }
    }, []);

    useEffect(() => {
        if (!currentUser?.id) return;

        const activeUserId = sessionStorage.getItem("activeUserId");
        if (activeUserId && activeUserId !== currentUser.id) {
            setActiveContact(null);
            setMessages([]);
        }
        sessionStorage.setItem("activeUserId", currentUser.id);

        connect();
        loadContacts();

        // Web Push (если пользователь разрешил уведомления)
        ensurePushSubscribed(currentUser.id).catch(() => {});
    }, [currentUser?.id]);

    useEffect(() => {
        if (!activeContact?.id) return;
        loadChatForContact(activeContact);
    }, [activeContact?.id]);

    useEffect(() => {
        if (!isProfileOpen || !activeContact?.username) return;
        loadContactProfile(activeContact);
    }, [isProfileOpen, activeContact?.username]);

    const connect = () => {
        const Stomp = require("stompjs");
        var SockJS = require("sockjs-client");
        SockJS = new SockJS("/api/chat/ws");
        stompClient = Stomp.over(SockJS);
        stompClient.connect({userId: currentUser.id}, onConnected, onError);
    };

    const onConnected = () => {
        console.log("connected");
        console.log(currentUser);
        stompClient.subscribe("/user/" + currentUser.id + "/queue/messages", onMessageReceived);
        stompClient.subscribe("/topic/status", onStatusReceived);
    };

    const onError = (err) => {
        console.log(err);
    };

    const onMessageReceived = (msg) => {
        const notification = JSON.parse(msg.body);
        const active = JSON.parse(sessionStorage.getItem("recoil-persist"))
            .chatActiveContact;

        if (active && active.id === notification.senderId) {
            findChatMessage(notification.id).then((message) => {
                const newMessages = JSON.parse(sessionStorage.getItem("recoil-persist"))
                    .chatMessages;
                newMessages.push(message);
                setMessages(newMessages);
            });
        } else {
            // message.info("Received a new message from " + notification.senderName); TODO для чего тут так?
        }
        loadContacts();
    };

    const onStatusReceived = (msg) => {
        const data = JSON.parse(msg.body); // {userId, status}
        setContacts(prevContacts =>
            prevContacts.map(contact => contact.id === data.userId ? {...contact, status: data.status} : contact)
        );
    };

    const sendMessage = (msg) => {
        if (msg.trim() !== "") {
            const message = {
                senderId: currentUser.id,
                recipientId: activeContact.id,
                senderName: currentUser.name,
                recipientName: activeContact.name,
                content: msg,
                timestamp: new Date(),
            };
            stompClient.send("/app/chat", {}, JSON.stringify(message));

            const newMessages = [...messages];
            newMessages.push(message);
            setMessages(newMessages);
            if (!contacts.some((contact) => contact.id === activeContact.id)) {
                setContacts([activeContact, ...contacts]);
            }
            loadContacts(activeContact?.id);
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

    const filteredContacts = contacts.filter((contact) =>
        isFuzzyMatch(searchQuery, contact.username || contact.name)
    );

    const searchResults = searchQuery.trim()
        ? allUsers.filter((user) => isFuzzyMatch(searchQuery, user.username || user.name))
        : [];

    const loadChatForContact = (contact) => {
        if (!contact?.id) return;
        setMessages([]);
        findChatMessages(contact.id, currentUser.id)
            .then(setMessages);
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

    const loadContacts = (forceContactId) => {
        Promise.all([getUsers(), getChatContacts(currentUser.id)])
            .then(([users, contactIds]) => {
                const idsWithForce = forceContactId && !contactIds.includes(forceContactId)
                    ? [...contactIds, forceContactId]
                    : contactIds;
                const contactsWithHistory = users.filter((contact) =>
                    contact.id !== currentUser.id && idsWithForce.includes(contact.id)
                );

                setAllUsers(users.filter((contact) => contact.id !== currentUser.id));

                return Promise.all(
                    contactsWithHistory.map((contact) =>
                        countNewMessages(contact.id, currentUser.id).then((count) => {
                            contact.newMessages = count;
                            return contact;
                        })
                    )
                );
            })
            .then((users) => {
                setContacts(users);
                const activeInList = users.find((contact) => contact.id === activeContact?.id);
                if (!activeInList && users.length > 0) {
                    setActiveContact(users[0]);
                }
            });
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

    const isNewDay = (current, previous) => {
        if (!previous) return true;
        const currDate = new Date(current).toDateString();
        const prevDate = new Date(previous).toDateString();
        return currDate !== prevDate;
    };

    return (
        <div id="frame" className={isMobileChatOpen ? "chat-open" : ""}>
            <div id="sidepanel">
                <div id="profile">
                    <div className="wrap">
                        <div className={`avatar-wrapper ${currentUser.status || "online"}`}>
                            <Avatar
                                name={currentUser.name}
                                src={currentUser.profilePicture}
                                size={50}
                            />
                        </div>
                        <p>{currentUser.name}</p>
                        <div id="status-options">
                            <ul>
                                <li id="status-online" className="active">
                                    <span className="status-circle"></span> <p>В сети</p>
                                </li>
                                <li id="status-away">
                                    <span className="status-circle"></span> <p>Нет на месте</p>
                                </li>
                                <li id="status-busy">
                                    <span className="status-circle"></span> <p>Занят</p>
                                </li>
                                <li id="status-offline">
                                    <span className="status-circle"></span> <p>Оффлайн</p>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div id="search">
                    <label htmlFor="contact-search">
                        <i className="fa fa-search" aria-hidden="true"></i>
                    </label>
                    <input
                        id="contact-search"
                        type="text"
                        placeholder="Поиск по имени пользователя"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                    />
                </div>
                {searchQuery.trim() && (
                    <div className="search-results">
                        <div className="search-results-title">Результаты поиска</div>
                        <ul>
                            {searchResults.length > 0 ? (
                                searchResults.map((user) => (
                                    <li
                                        key={user.id}
                                        className="search-result-item"
                                        onClick={() => {
                                            setIsMobileChatOpen(true);
                                            setActiveContact(user);
                                            setSearchQuery("");
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
                <div id="contacts">
                    <ul>
                        {filteredContacts.map((contact) => (
                            <li
                                key={contact.id}
                                onClick={() => {
                                    setIsMobileChatOpen(true);
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
                                        <p className="name">
                                            {contact.name}
                                        </p>
                                        {contact.newMessages !== undefined && contact.newMessages > 0 && (
                                            <p className="preview">
                                                {contact.newMessages} новых сообщений
                                            </p>
                                        )}
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
                            <button className="back-btn" onClick={() => setIsMobileChatOpen(false)}>
                                ←
                            </button>
                            <button
                                type="button"
                                className="contact-profile-trigger"
                                onClick={() => setIsProfileOpen(true)}
                            >
                                <Avatar
                                    name={activeContact.name}
                                    src={activeContact.profilePicture}
                                    size={44}
                                />
                                <span className="contact-profile-name">{activeContact.name}</span>
                            </button>
                        </div>

                        <ScrollToBottom key={activeContact.id} className="messages">
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

                                                <p className="message-bubble">
                                                    <span className="text">{msg.content}</span>
                                                    <span className="time">{formatTime(msg.timestamp)}</span>
                                                </p>
                                            </li>
                                        </React.Fragment>
                                    );
                                })}
                            </ul>
                        </ScrollToBottom>

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
                        <Spin />
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
                    </div>
                )}
            </Drawer>
        </div>
    );
};

export default Chat;
