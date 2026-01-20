import React, {useEffect, useState} from "react";
import {Button, message} from "antd";
import {
    getUsers,
    countNewMessages,
    findChatMessages,
    findChatMessage,
} from "../util/ApiUtil";
import {useRecoilValue, useRecoilState} from "recoil";
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
    const currentUser = useRecoilValue(loggedInUser);
    const [text, setText] = useState("");
    const [contacts, setContacts] = useState([]);
    const [activeContact, setActiveContact] = useRecoilState(chatActiveContact);
    const [messages, setMessages] = useRecoilState(chatMessages);
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

    useEffect(() => {
        if (localStorage.getItem("accessToken") === null) {
            props.history.push("/login");
        }
        connect();
        loadContacts();
    }, []);

    useEffect(() => {
        if (!activeContact?.id) return;
        setMessages([]);

        findChatMessages(activeContact.id, currentUser.id)
            .then(setMessages);
    }, [activeContact?.id]);

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

        if (active.id === notification.senderId) {
            findChatMessage(notification.id).then((message) => {
                const newMessages = JSON.parse(sessionStorage.getItem("recoil-persist"))
                    .chatMessages;
                newMessages.push(message);
                setMessages(newMessages);
            });
        } else {
            message.info("Received a new message from " + notification.senderName);
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
        }
    };

    const loadContacts = () => {
        const promise = getUsers().then((users) =>
            users.map((contact) =>
                countNewMessages(contact.id, currentUser.id).then((count) => {
                    contact.newMessages = count;
                    return contact;
                })
            )
        );

        promise.then((promises) =>
            Promise.all(promises).then((users) => {
                setContacts(users);
                if (activeContact === undefined && users.length > 0) {
                    setActiveContact(users[0]);
                }
            })
        );
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
                    <div class="wrap">
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
                                <li id="status-online" class="active">
                                    <span class="status-circle"></span> <p>Online</p>
                                </li>
                                <li id="status-away">
                                    <span class="status-circle"></span> <p>Away</p>
                                </li>
                                <li id="status-busy">
                                    <span class="status-circle"></span> <p>Busy</p>
                                </li>
                                <li id="status-offline">
                                    <span class="status-circle"></span> <p>Offline</p>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div id="search"/>
                <div id="contacts">
                    <ul>
                        {contacts.map((contact) => (
                            <li
                                onClick={() => {
                                    setActiveContact(contact);
                                    setIsMobileChatOpen(true);
                                }}
                                class={
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
                                                {contact.newMessages} new messages
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
                        <span>Profile</span>
                    </button>
                    <button id="settings">
                        <i class="fa fa-cog fa-fw" aria-hidden="true"></i>{" "}
                        <span>Settings</span>
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
                            <Avatar
                                name={activeContact.name}
                                src={activeContact.profilePicture}
                                size={44}
                            />
                            <p>{activeContact.name}</p>
                        </div>

                        <ScrollToBottom key={activeContact.id} className="messages">
                            <ul>
                                {messages.map((msg, index) => {
                                    const showDate = isNewDay(msg.timestamp, messages[index - 1]?.timestamp);

                                    return (
                                        <React.Fragment key={msg.id}>
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
                                    placeholder="Write your message..."
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
                                    icon={<i className="fa fa-paper-plane" />}
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
        </div>
    );
};

export default Chat;
