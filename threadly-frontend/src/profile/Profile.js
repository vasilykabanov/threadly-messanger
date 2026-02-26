import React, {useEffect, useRef, useState} from "react";
import {Card, Avatar, Button, Divider, Form, Input, message, Spin} from "antd";
import {useRecoilState} from "recoil";
import {loggedInUser} from "../atom/globalState";
import {getCurrentUser, updateProfile, uploadAvatar} from "../util/ApiUtil";
import "./Profile.css";

const {Meta} = Card;

const Profile = (props) => {
    const [currentUser, setLoggedInUser] = useRecoilState(loggedInUser);
    const [profileForm] = Form.useForm();
    const [savingProfile, setSavingProfile] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [avatarFile, setAvatarFile] = useState(null);
    const fileInputRef = useRef(null);
    const [backTarget, setBackTarget] = useState("/chat");

    const clearPersistedState = () => {
        const persisted = sessionStorage.getItem("recoil-persist");
        if (!persisted) return;

        try {
            const data = JSON.parse(persisted);
            delete data.chatActiveContact;
            delete data.chatMessages;
            delete data.loggedInUser;
            sessionStorage.setItem("recoil-persist", JSON.stringify(data));
        } catch (e) {
            sessionStorage.removeItem("recoil-persist");
        }
    };

    useEffect(() => {
        if (localStorage.getItem("accessToken") === null) {
            props.history.push("/login");
        }
        loadCurrentUser();
    }, []);

    useEffect(() => {
        try {
            const stored = sessionStorage.getItem("profileBack") || "/chat";
            setBackTarget(stored);
        } catch (error) {
            setBackTarget("/chat");
        }
    }, []);

    useEffect(() => {
        if (!currentUser?.username) return;
        profileForm.setFieldsValue({
            name: currentUser.name,
            username: currentUser.username,
            email: currentUser.email,
            profilePictureUrl: currentUser.profilePicture,
        });
    }, [currentUser?.username, profileForm]);

    const loadCurrentUser = () => {
        getCurrentUser()
            .then((response) => {
                setLoggedInUser(response);
            })
            .catch((error) => {
                console.log(error);
            });
    };

    const logout = () => {
        clearPersistedState();
        localStorage.removeItem("accessToken");
        props.history.push("/login");
    };

    const goToChat = () => {
        window.scrollTo(0, 0);
        props.history.push("/chat");
    };

    const goToSettings = () => {
        props.history.push("/settings");
    };

    const goBackTarget = () => {
        props.history.push(backTarget);
    };

    const onUpdateProfile = (values) => {
        setSavingProfile(true);
        updateProfile(values)
            .then((response) => {
                setLoggedInUser(response);
                if (values.email !== currentUser.email) {
                    message.success("Профиль обновлён. Мы отправили письмо для подтверждения нового email.");
                } else {
                    message.success("Профиль обновлён");
                }
            })
            .catch((error) => {
                message.error(error?.message || "Не удалось обновить профиль");
            })
            .finally(() => setSavingProfile(false));
    };


    return (
        <div className="profile-container">
            <button className="mobile-back-btn" onClick={goBackTarget}>
                {backTarget === "/settings" ? "← К настройкам" : "← К чатам"}
            </button>
            <div className="desktop-back-row">
                <Button type="text" onClick={goToChat}>← К чатам</Button>
                <Button type="text" onClick={goToSettings}>← К настройкам</Button>
            </div>
            <Card
                style={{width: "100%"}}
                actions={[
                    <Button type="primary" danger onClick={logout}>Выйти</Button>
                ]}
            >
                <div className="profile-header-centered">
                    <div
                        className="avatar-edit-wrapper"
                        onClick={() => fileInputRef.current?.click()}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => event.key === "Enter" && fileInputRef.current?.click()}
                    >
                        <Avatar
                            src={avatarPreview || currentUser.profilePicture}
                            className="user-avatar-circle"
                        >
                            {currentUser.name?.[0]?.toUpperCase()}
                        </Avatar>
                        <div className="avatar-edit-overlay">
                            {avatarUploading ? (
                                <Spin size="small" />
                            ) : (
                                <i className="fa fa-camera" aria-hidden="true" />
                            )}
                        </div>
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            className="avatar-file-input"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (!file) return;
                                if (!file.type.startsWith("image/")) {
                                    message.warning("Выберите файл изображения");
                                    return;
                                }
                                const url = URL.createObjectURL(file);
                                setAvatarPreview(url);
                                setAvatarFile(file);
                            }}
                        />
                    </div>
                    <div className="profile-header-name">{currentUser.name}</div>
                    <div className="profile-header-username">{"@" + currentUser.username}</div>
                </div>
                <div className="avatar-actions-row">
                    <Button
                        size="small"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        Изменить фотографию
                    </Button>
                    {avatarPreview && (
                        <>
                            <Button
                                type="primary"
                                size="small"
                                loading={avatarUploading}
                                onClick={() => {
                                    if (!avatarFile || avatarUploading) return;
                                    setAvatarUploading(true);
                                    uploadAvatar(avatarFile)
                                        .then((response) => {
                                            setLoggedInUser(response);
                                            setAvatarPreview(null);
                                            setAvatarFile(null);
                                            message.success("Аватар обновлён");
                                        })
                                        .catch((error) => {
                                            message.error(error?.message || "Не удалось обновить аватар");
                                        })
                                        .finally(() => {
                                            setAvatarUploading(false);
                                        });
                                }}
                            >
                                Сохранить
                            </Button>
                            <Button
                                size="small"
                                onClick={() => {
                                    setAvatarPreview(null);
                                    setAvatarFile(null);
                                }}
                            >
                                Отменить
                            </Button>
                        </>
                    )}
                </div>

                <Divider>Профиль</Divider>
                <Form
                    form={profileForm}
                    layout="vertical"
                    onFinish={onUpdateProfile}
                    className="profile-form"
                >
                    <Form.Item
                        name="name"
                        label="Имя"
                        rules={[
                            {required: true, message: "Введите имя"},
                            {min: 3, max: 40, message: "От 3 до 40 символов"},
                        ]}
                    >
                        <Input placeholder="Ваше имя"/>
                    </Form.Item>

                    <Form.Item
                        name="username"
                        label="Имя пользователя"
                        rules={[
                            {required: true, message: "Введите имя пользователя"},
                            {min: 3, max: 15, message: "От 3 до 15 символов"},
                        ]}
                    >
                        <Input placeholder="username"/>
                    </Form.Item>

                    <Form.Item
                        name="email"
                        label="Email"
                        rules={[
                            {required: true, message: "Введите email"},
                            {type: "email", message: "Некорректный email"},
                        ]}
                    >
                        <Input placeholder="email@example.com"/>
                    </Form.Item>

                    <Form.Item
                        name="profilePictureUrl"
                        label="Ссылка на аватар"
                    >
                        <Input placeholder="https://..."/>
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={savingProfile}>
                            Сохранить изменения
                        </Button>
                    </Form.Item>
                </Form>

            </Card>
            <div className="mobile-bottom-nav">
                <button type="button" className="mobile-nav-item" onClick={goToChat}>
                    <i className="fa fa-comments" aria-hidden="true"></i>
                    <span>Чаты</span>
                </button>
                <button type="button" className="mobile-nav-item" onClick={goToSettings}>
                    <i className="fa fa-cog" aria-hidden="true"></i>
                    <span>Настройки</span>
                </button>
            </div>
        </div>
    );
};

export default Profile;
