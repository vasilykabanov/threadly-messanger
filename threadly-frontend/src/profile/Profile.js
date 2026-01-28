import React, {useEffect, useState} from "react";
import {Card, Avatar, Button, Divider, Form, Input, Switch, message} from "antd";
import {useRecoilState} from "recoil";
import {loggedInUser, uiTheme, uiThemeMode} from "../atom/globalState";
import {getCurrentUser, updateProfile} from "../util/ApiUtil";
import "./Profile.css";

const {Meta} = Card;

const Profile = (props) => {
    const [currentUser, setLoggedInUser] = useRecoilState(loggedInUser);
    const [theme, setTheme] = useRecoilState(uiTheme);
    const [themeMode, setThemeMode] = useRecoilState(uiThemeMode);
    const [profileForm] = Form.useForm();
    const [savingProfile, setSavingProfile] = useState(false);
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
        try {
            localStorage.setItem("uiTheme", theme);
        } catch (error) {
        }
    }, [theme]);

    useEffect(() => {
        try {
            localStorage.setItem("uiThemeMode", themeMode);
        } catch (error) {
        }
    }, [themeMode]);

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
            <Card
                style={{width: "100%"}}
                actions={[
                    <Button type="primary" danger onClick={logout}>Выйти</Button>,
                    <Button type="default" onClick={goToSettings}>Настройки</Button>
                ]}
            >
                <Meta
                    avatar={
                        <Avatar src={currentUser.profilePicture} className="user-avatar-circle">
                            {currentUser.name?.[0]?.toUpperCase()}
                        </Avatar>
                    }
                    title={currentUser.name}
                    description={"@" + currentUser.username}
                />

                <Divider>Дизайн</Divider>
                <div className="settings-theme-toggle">
                    <div className="settings-theme-text">
                        <div className="settings-theme-title">Новый космический дизайн</div>
                        <div className="settings-theme-subtitle">
                            Стеклянные панели, неоновый акцент и крупная типографика
                        </div>
                    </div>
                    <Switch
                        checked={theme === "new"}
                        onChange={(checked) => setTheme(checked ? "new" : "legacy")}
                    />
                </div>
                {theme === "new" && (
                    <div className="settings-theme-toggle">
                        <div className="settings-theme-text">
                            <div className="settings-theme-title">Тема</div>
                            <div className="settings-theme-subtitle">
                                {themeMode === "dark" ? "Тёмная" : "Светлая"}
                            </div>
                        </div>
                        <Switch
                            checked={themeMode === "dark"}
                            checkedChildren="Тёмная"
                            unCheckedChildren="Светлая"
                            onChange={(checked) => setThemeMode(checked ? "dark" : "light")}
                        />
                    </div>
                )}

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
        </div>
    );
};

export default Profile;
