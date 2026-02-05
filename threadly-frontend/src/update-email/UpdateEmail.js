import React, { useState } from "react";
import { Button, Form, Input, notification } from "antd";
import { UserOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";
import { updateEmailBeforeVerification } from "../util/ApiUtil";
import "./UpdateEmail.css";

const UpdateEmail = (props) => {
    const [loading, setLoading] = useState(false);

    const onFinish = (values) => {
        setLoading(true);
        updateEmailBeforeVerification(values)
            .then(() => {
                notification.success({
                    message: "Email обновлён",
                    description: "Мы отправили письмо с ссылкой для подтверждения на новый email.",
                });
                props.history.push("/check-email?email=" + encodeURIComponent(values.newEmail));
            })
            .catch((error) => {
                notification.error({
                    message: "Ошибка",
                    description: error.message || "Не удалось обновить email",
                });
            })
            .finally(() => setLoading(false));
    };

    const goToLogin = () => {
        props.history.push("/login");
    };

    return (
        <div className="update-email-container">
            <div className="auth-card">
                <img
                    src="/logo50.png" alt="Threadly"
                    className="auth-logo"
                />
                <div className="auth-title">Обновление email</div>
                <div className="auth-subtitle">
                    Если при регистрации указали неправильный email, укажите логин, пароль и новый email.
                </div>
                <Form
                    name="update_email"
                    className="login-form"
                    onFinish={onFinish}
                >
                    <Form.Item
                        name="username"
                        rules={[{ required: true, message: "Введите логин!" }]}
                    >
                        <Input
                            size="large"
                            prefix={<UserOutlined className="site-form-item-icon" />}
                            placeholder="Логин"
                        />
                    </Form.Item>
                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: "Введите пароль!" }]}
                    >
                        <Input
                            size="large"
                            prefix={<LockOutlined className="site-form-item-icon" />}
                            type="password"
                            placeholder="Пароль"
                        />
                    </Form.Item>
                    <Form.Item
                        name="newEmail"
                        rules={[{ required: true, message: "Введите новый email!" }]}
                    >
                        <Input
                            size="large"
                            prefix={<MailOutlined className="site-form-item-icon" />}
                            type="email"
                            placeholder="Новый email"
                        />
                    </Form.Item>
                    <Form.Item>
                        <Button
                            shape="round"
                            size="large"
                            htmlType="submit"
                            className="login-form-button"
                            loading={loading}
                        >
                            Обновить email
                        </Button>
                    </Form.Item>
                    <div className="auth-footer">
                        Вспомнили правильный email?{" "}
                        <a onClick={goToLogin} className="auth-link">
                            Вернуться к входу
                        </a>
                    </div>
                </Form>
            </div>
        </div>
    );
};

export default UpdateEmail;

