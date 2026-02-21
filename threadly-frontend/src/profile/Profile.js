import React, {useEffect, useState} from "react";
import {Card, Avatar, Button, Divider, Form, Input, message} from "antd";
import {useRecoilState} from "recoil";
import {loggedInUser} from "../atom/globalState";
import {getCurrentUser, updateProfile, uploadAvatar} from "../util/ApiUtil";
import "./Profile.css";

const {Meta} = Card;

const Profile = (props) => {
    const [currentUser, setLoggedInUser] = useRecoilState(loggedInUser);
    const [profileForm] = Form.useForm();
    const [savingProfile, setSavingProfile] = useState(false);
    const [backTarget, setBackTarget] = useState("/chat");
    const [avatarUploading, setAvatarUploading] = useState(false);

    const handleAvatarUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
            message.error("Поддерживаются только форматы: JPG, PNG, GIF, WEBP");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            message.error("Файл слишком большой (макс. 5MB)");
            return;
        }

        setAvatarUploading(true);
        uploadAvatar(file)
            .then((response) => {
                setLoggedInUser(response);
                message.success("Аватар обновлён");
            })
            .catch((error) => {
                message.error(error?.message || "Не удалось загрузить аватар");
            })
            .finally(() => setAvatarUploading(false));
    };

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
                message.success("Профиль обновлён");
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
                <Meta
                    avatar={
                        <div style={{position: "relative", display: "inline-block"}}>
                            <Avatar src={currentUser.profilePicture} className="user-avatar-circle">
                                {currentUser.name?.[0]?.toUpperCase()}
                            </Avatar>
                            <label
                                htmlFor="profile-avatar-upload"
                                style={{
                                    position: "absolute",
                                    bottom: 0,
                                    right: 0,
                                    width: 32,
                                    height: 32,
                                    borderRadius: "50%",
                                    background: "#7c3aed",
                                    color: "#fff",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                                    fontSize: 14,
                                }}
                            >
                                {avatarUploading ? "…" : <i className="fa fa-camera" />}
                            </label>
                            <input
                                id="profile-avatar-upload"
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                style={{display: "none"}}
                                onChange={handleAvatarUpload}
                                disabled={avatarUploading}
                            />
                        </div>
                    }
                    title={currentUser.name}
                    description={"@" + currentUser.username}
                />

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
                            {
                                validator: (_, value) => {
                                    if (!value) return Promise.resolve();
                                    return /^[a-zA-Z0-9_-]+$/.test(value)
                                        ? Promise.resolve()
                                        : Promise.reject(new Error("Разрешены только: a-z, A-Z, 0-9, - и _"));
                                },
                            },
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
