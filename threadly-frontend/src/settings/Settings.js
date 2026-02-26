import React, {useEffect, useState} from "react";
import {Card, Button, Modal, Form, Input, Switch, message} from "antd";
import {changePassword, getCurrentUser, updateProfile, ensurePushSubscribed, uploadAvatar} from "../util/ApiUtil";
import {useRecoilState} from "recoil";
import {loggedInUser, uiThemeMode} from "../atom/globalState";
import Avatar from "../profile/Avatar";
import "../profile/Profile.css";

const Settings = (props) => {
    const [currentUser, setLoggedInUser] = useRecoilState(loggedInUser);
    const [themeMode, setThemeMode] = useRecoilState(uiThemeMode);
    const [profileForm] = Form.useForm();
    const [passwordForm] = Form.useForm();
    const [savingProfile, setSavingProfile] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);

    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [designModalOpen, setDesignModalOpen] = useState(false);
    const [pushEnabled, setPushEnabled] = useState(false);
    const [pushLoading, setPushLoading] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [avatarFile, setAvatarFile] = useState(null);
    const [isAvatarViewerOpen, setIsAvatarViewerOpen] = useState(false);

    const avatarFileInputRef = React.useRef(null);

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
    }, [currentUser?.username, currentUser?.profilePicture, profileForm, profileModalOpen]);

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
            <Card style={{width: "100%"}} bordered={false}>
                <div className="profile-header-centered">
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                            if (avatarPreview || currentUser.profilePicture) {
                                setIsAvatarViewerOpen(true);
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && (avatarPreview || currentUser.profilePicture)) {
                                setIsAvatarViewerOpen(true);
                            }
                        }}
                    >
                        <Avatar
                            src={avatarPreview || currentUser.profilePicture}
                            name={currentUser.name}
                            size={100}
                        />
                    </div>
                    <div className="profile-header-name">{currentUser.name}</div>
                    <div className="profile-header-username">@{currentUser.username}</div>
                </div>

                <input
                    type="file"
                    accept="image/*"
                    ref={avatarFileInputRef}
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
                         Modal.confirm({
                             title: "Сохранить новое фото профиля?",
                             okText: "Сохранить",
                             cancelText: "Отмена",
                             centered: true,
                             onOk: () => {
                                 if (!file) return;
                                 setAvatarUploading(true);
                                 return uploadAvatar(file)
                                     .then((response) => {
                                         setLoggedInUser(response);
                                         profileForm.setFieldsValue({
                                             ...profileForm.getFieldsValue(),
                                             profilePictureUrl: response.profilePicture,
                                         });
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
                             },
                             onCancel: () => {
                                 setAvatarPreview(null);
                                 setAvatarFile(null);
                             },
                         });
                    }}
                />

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
                        onClick={() => avatarFileInputRef.current?.click()}
                    >
                        <span className="settings-menu-left">
                            <i className="fa fa-camera" aria-hidden="true"></i>
                            <span>Изменить фотографию</span>
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
                        <div style={{display: "flex", gap: 8}}>
                            <Button type="primary" htmlType="submit" loading={savingProfile} style={{flex: 1}}>
                                Сохранить
                            </Button>
                            {avatarPreview && (
                                <>
                                    <Button
                                        type="default"
                                        loading={avatarUploading}
                                        onClick={() => {
                                            if (!avatarFile || avatarUploading) return;
                                            setAvatarUploading(true);
                                            uploadAvatar(avatarFile)
                                                .then((response) => {
                                                    setLoggedInUser(response);
                                                    profileForm.setFieldsValue({
                                                        ...profileForm.getFieldsValue(),
                                                        profilePictureUrl: response.profilePicture,
                                                    });
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
                                        Сохранить фото
                                    </Button>
                                    <Button
                                        type="link"
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

            {/* Модальное окно: Дизайн (тема) */}
            <Modal
                title="Дизайн"
                open={designModalOpen}
                onCancel={() => setDesignModalOpen(false)}
                footer={null}
            >
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
            </Modal>

            <Modal
                open={isAvatarViewerOpen}
                footer={null}
                onCancel={() => setIsAvatarViewerOpen(false)}
                width="80%"
                className="photo-viewer-modal"
                centered
            >
                {(avatarPreview || currentUser.profilePicture) && (
                    <img
                        src={avatarPreview || currentUser.profilePicture}
                        alt={currentUser.name || currentUser.username || "Аватар"}
                        className="photo-viewer-image"
                    />
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
