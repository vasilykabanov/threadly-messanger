import React, {useEffect, useState} from "react";
import {Card, Button, Divider, Form, Input, Switch, message} from "antd";
import {changePassword, getCurrentUser} from "../util/ApiUtil";
import {useRecoilState} from "recoil";
import {loggedInUser, uiTheme, uiThemeMode} from "../atom/globalState";
import "../profile/Profile.css";

const Settings = (props) => {
    const [currentUser, setLoggedInUser] = useRecoilState(loggedInUser);
    const [theme, setTheme] = useRecoilState(uiTheme);
    const [themeMode, setThemeMode] = useRecoilState(uiThemeMode);
    const [passwordForm] = Form.useForm();
    const [changingPassword, setChangingPassword] = useState(false);

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

    const onChangePassword = (values) => {
        setChangingPassword(true);
        changePassword({
            currentPassword: values.currentPassword,
            newPassword: values.newPassword,
        })
            .then(() => {
                message.success("Пароль изменён");
                passwordForm.resetFields();
            })
            .catch((error) => {
                message.error(error?.message || "Не удалось изменить пароль");
            })
            .finally(() => setChangingPassword(false));
    };

    const goToProfile = () => {
        try {
            sessionStorage.setItem("profileBack", "/settings");
        } catch (error) {
        }
        props.history.push("/");
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
                <Button type="text" onClick={goToProfile}>← К профилю</Button>
            </div>
            <Card style={{width: "100%"}}>
                <div style={{textAlign: "center", fontWeight: 600}}>
                    Настройки аккаунта
                </div>
                <div style={{textAlign: "center", color: "#888", marginTop: 4}}>
                    {currentUser?.username ? `@${currentUser.username}` : ""}
                </div>

                <Button type="text" className="settings-nav-item" onClick={goToProfile}>
                    <span className="settings-nav-left">
                        <i className="fa fa-user" aria-hidden="true"></i>
                        <span>Мой профиль</span>
                    </span>
                    <span className="settings-nav-arrow">→</span>
                </Button>

                <Divider>Смена пароля</Divider>
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

                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={changingPassword}>
                            Обновить пароль
                        </Button>
                    </Form.Item>
                </Form>

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

                <Divider />
                <Button danger type="primary" block onClick={logout}>
                    Выйти из аккаунта
                </Button>
            </Card>
            <div className="mobile-bottom-nav">
                <button type="button" className="mobile-nav-item" onClick={goToChat}>
                    <i className="fa fa-comments" aria-hidden="true"></i>
                    <span>Чаты</span>
                </button>
                <button type="button" className="mobile-nav-item active">
                    <i className="fa fa-cog" aria-hidden="true"></i>
                    <span>Настройки</span>
                </button>
                <button type="button" className="mobile-nav-item danger" onClick={logout}>
                    <i className="fa fa-sign-out" aria-hidden="true"></i>
                    <span>Выйти</span>
                </button>
            </div>
        </div>
    );
};

export default Settings;
