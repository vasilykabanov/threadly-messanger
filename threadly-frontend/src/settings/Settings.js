import React, {useEffect, useState} from "react";
import {Card, Button, Divider, Form, Input, Switch, message} from "antd";
import {changePassword, getCurrentUser} from "../util/ApiUtil";
import {useRecoilState} from "recoil";
import {loggedInUser, uiTheme} from "../atom/globalState";
import "../profile/Profile.css";

const Settings = (props) => {
    const [currentUser, setLoggedInUser] = useRecoilState(loggedInUser);
    const [theme, setTheme] = useRecoilState(uiTheme);
    const [passwordForm] = Form.useForm();
    const [changingPassword, setChangingPassword] = useState(false);

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
        props.history.push("/");
    };

    const goToChat = () => {
        props.history.push("/chat");
    };

    return (
        <div className="profile-container">
            <Card
                style={{width: 520, border: "1px solid #e1e0e0"}}
                actions={[
                    <Button type="default" onClick={goToProfile}>Профиль</Button>,
                    <Button type="default" onClick={goToChat}>Чаты</Button>
                ]}
            >
                <div style={{textAlign: "center", fontWeight: 600}}>
                    Настройки аккаунта
                </div>
                <div style={{textAlign: "center", color: "#888", marginTop: 4}}>
                    {currentUser?.username ? `@${currentUser.username}` : ""}
                </div>

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
            </Card>
        </div>
    );
};

export default Settings;
