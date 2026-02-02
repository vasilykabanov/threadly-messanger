import React, {useEffect, useState} from "react";
import {Card, Button, Modal, Form, Input, Switch, message} from "antd";
import {changePassword, getCurrentUser, updateProfile, ensurePushSubscribed} from "../util/ApiUtil";
import {useRecoilState} from "recoil";
import {loggedInUser, uiTheme, uiThemeMode} from "../atom/globalState";
import Avatar from "../profile/Avatar";
import "../profile/Profile.css";

const Settings = (props) => {
    const [currentUser, setLoggedInUser] = useRecoilState(loggedInUser);
    const [theme, setTheme] = useRecoilState(uiTheme);
    const [themeMode, setThemeMode] = useRecoilState(uiThemeMode);
    const [profileForm] = Form.useForm();
    const [passwordForm] = Form.useForm();
    const [savingProfile, setSavingProfile] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);

    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [designModalOpen, setDesignModalOpen] = useState(false);
    const [pushEnabled, setPushEnabled] = useState(false);
    const [pushLoading, setPushLoading] = useState(false);

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
        getCurrentUser()
            .then((response) => setLoggedInUser(response))
            .catch(() => {});
        
        // Проверяем статус push-уведомлений
        checkPushStatus();
    }, []);

    const checkPushStatus = async () => {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
            return;
        }
        try {
            const permission = Notification.permission;
            if (permission === "granted") {
                const registration = await navigator.serviceWorker.getRegistration("/push-sw.js");
                if (registration) {
                    const subscription = await registration.pushManager.getSubscription();
                    setPushEnabled(!!subscription);
                }
            }
        } catch (e) {
            console.warn("Failed to check push status:", e);
        }
    };

    const handlePushToggle = async () => {
        if (!currentUser?.id) {
            message.error("Сначала войдите в аккаунт");
            return;
        }
        
        setPushLoading(true);
        try {
            await ensurePushSubscribed(currentUser.id);
            setPushEnabled(true);
            message.success("Уведомления включены");
        } catch (e) {
            console.error("Failed to enable push:", e);
            message.error("Не удалось включить уведомления");
        } finally {
            setPushLoading(false);
        }
    };

    useEffect(() => {
        if (!currentUser?.username) return;
        profileForm.setFieldsValue({
            name: currentUser.name,
            username: currentUser.username,
            email: currentUser.email,
            profilePictureUrl: currentUser.profilePicture,
        });
    }, [currentUser?.username, profileForm, profileModalOpen]);

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

    const onUpdateProfile = (values) => {
        setSavingProfile(true);
        updateProfile(values)
            .then((response) => {
                setLoggedInUser(response);
                message.success("Профиль обновлён");
                setProfileModalOpen(false);
            })
            .catch((error) => {
                const errorMessage =
                    error?.message && !/bad request/i.test(error.message)
                        ? error.message
                        : "Не удалось обновить профиль";
                message.error(errorMessage);
            })
            .finally(() => setSavingProfile(false));
    };

    const onChangePassword = (values) => {
        setChangingPassword(true);
        changePassword({
            currentPassword: values.currentPassword,
            newPassword: values.newPassword,
        })
            .then(() => {
                message.success("Пароль изменён");
                passwordForm.resetFields();
                setPasswordModalOpen(false);
            })
            .catch((error) => {
                const errorMessage =
                    error?.message && !/bad request/i.test(error.message)
                        ? error.message
                        : "Не удалось изменить пароль";
                message.error(errorMessage);
            })
            .finally(() => setChangingPassword(false));
    };

    const goToChat = () => {
        window.scrollTo(0, 0);
        props.history.push("/chat");
    };

    const logout = () => {
        clearPersistedState();
        localStorage.removeItem("accessToken");
        props.history.push("/login");
    };

    return (
        <div className="profile-container">
            <div className="desktop-back-row">
                <Button type="text" onClick={goToChat}>← К чатам</Button>
            </div>
            <Card style={{width: "100%"}}>
                <div className="profile-header-centered">
                    <Avatar
                        src={currentUser.profilePicture}
                        name={currentUser.name}
                        size={100}
                    />
                    <div className="profile-header-name">{currentUser.name}</div>
                    <div className="profile-header-username">@{currentUser.username}</div>
                </div>

                <div className="settings-menu">
                    <button
                        type="button"
                        className="settings-menu-item"
                        onClick={() => setProfileModalOpen(true)}
                    >
                        <span className="settings-menu-left">
                            <i className="fa fa-user" aria-hidden="true"></i>
                            <span>Профиль</span>
                        </span>
                        <span className="settings-menu-arrow">›</span>
                    </button>

                    <button
                        type="button"
                        className="settings-menu-item"
                        onClick={() => setPasswordModalOpen(true)}
                    >
                        <span className="settings-menu-left">
                            <i className="fa fa-lock" aria-hidden="true"></i>
                            <span>Смена пароля</span>
                        </span>
                        <span className="settings-menu-arrow">›</span>
                    </button>

                    <button
                        type="button"
                        className="settings-menu-item"
                        onClick={() => setDesignModalOpen(true)}
                    >
                        <span className="settings-menu-left">
                            <i className="fa fa-paint-brush" aria-hidden="true"></i>
                            <span>Дизайн</span>
                        </span>
                        <span className="settings-menu-arrow">›</span>
                    </button>

                    {"serviceWorker" in navigator && "PushManager" in window && (
                        <button
                            type="button"
                            className="settings-menu-item"
                            onClick={handlePushToggle}
                            disabled={pushLoading || pushEnabled}
                        >
                            <span className="settings-menu-left">
                                <i className="fa fa-bell" aria-hidden="true"></i>
                                <span>
                                    {pushLoading ? "Включение..." : pushEnabled ? "Уведомления включены" : "Включить уведомления"}
                                </span>
                            </span>
                            <span className="settings-menu-arrow">
                                {pushEnabled ? "✓" : "›"}
                            </span>
                        </button>
                    )}
                </div>

                <Button
                    danger
                    type="primary"
                    block
                    onClick={logout}
                    style={{marginTop: 24}}
                >
                    Выйти из аккаунта
                </Button>
            </Card>

            {/* Модальное окно: Профиль */}
            <Modal
                title="Редактирование профиля"
                open={profileModalOpen}
                onCancel={() => setProfileModalOpen(false)}
                footer={null}
                destroyOnClose
            >
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

                    <Form.Item style={{marginBottom: 0}}>
                        <Button type="primary" htmlType="submit" loading={savingProfile} block>
                            Сохранить
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Модальное окно: Смена пароля */}
            <Modal
                title="Смена пароля"
                open={passwordModalOpen}
                onCancel={() => setPasswordModalOpen(false)}
                footer={null}
                destroyOnClose
            >
                <Form
                    form={passwordForm}
                    layout="vertical"
                    onFinish={onChangePassword}
                    className="profile-form"
                >
                    <Form.Item
                        name="currentPassword"
                        label="Текущий пароль"
                        rules={[{required: true, message: "Введите текущий пароль"}]}
                    >
                        <Input.Password placeholder="Текущий пароль"/>
                    </Form.Item>

                    <Form.Item
                        name="newPassword"
                        label="Новый пароль"
                        rules={[
                            {required: true, message: "Введите новый пароль"},
                            {min: 6, max: 20, message: "От 6 до 20 символов"},
                        ]}
                    >
                        <Input.Password placeholder="Новый пароль"/>
                    </Form.Item>

                    <Form.Item
                        name="confirmPassword"
                        label="Повторите новый пароль"
                        dependencies={["newPassword"]}
                        rules={[
                            {required: true, message: "Повторите новый пароль"},
                            ({getFieldValue}) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue("newPassword") === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error("Пароли не совпадают"));
                                },
                            }),
                        ]}
                    >
                        <Input.Password placeholder="Повторите пароль"/>
                    </Form.Item>

                    <Form.Item style={{marginBottom: 0}}>
                        <Button type="primary" htmlType="submit" loading={changingPassword} block>
                            Обновить пароль
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Модальное окно: Дизайн */}
            <Modal
                title="Дизайн"
                open={designModalOpen}
                onCancel={() => setDesignModalOpen(false)}
                footer={null}
            >
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
            </Modal>

            <div className="mobile-bottom-nav">
                <button type="button" className="mobile-nav-item" onClick={goToChat}>
                    <i className="fa fa-comments" aria-hidden="true"></i>
                    <span>Чаты</span>
                </button>
                <button type="button" className="mobile-nav-item active">
                    <i className="fa fa-cog" aria-hidden="true"></i>
                    <span>Настройки</span>
                </button>
            </div>
        </div>
    );
};

export default Settings;
