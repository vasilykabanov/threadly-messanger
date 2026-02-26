import React, { useState, useEffect } from "react";
import { Form, Input, Button, notification, Alert } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { resetPassword } from "../util/ApiUtil";
import "./ResetPassword.css";

const ResetPassword = (props) => {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [token, setToken] = useState("");

    useEffect(() => {
        const params = new URLSearchParams(props.location?.search || window.location.search);
        const t = params.get("token");
        if (t) setToken(t);
    }, [props.location]);

    const onFinish = (values) => {
        if (values.newPassword !== values.confirmPassword) {
            notification.error({
                message: "Ошибка",
                description: "Пароли не совпадают",
            });
            return;
        }
        setLoading(true);
        resetPassword({
            token,
            newPassword: values.newPassword,
            confirmPassword: values.confirmPassword,
        })
            .then(() => {
                setSuccess(true);
                notification.success({
                    message: "Пароль изменён",
                    description: "Теперь вы можете войти с новым паролем.",
                });
            })
            .catch((error) => {
                notification.error({
                    message: "Ошибка",
                    description:
                        error.message || "Не удалось сбросить пароль. Возможно, ссылка устарела.",
                });
            })
            .finally(() => setLoading(false));
    };

    if (!token) {
        return (
            <div className="login-container">
                <div className="auth-card">
                    <img src="/logo50.png" alt="Threadly" className="auth-logo" />
                    <div className="auth-title">Сброс пароля</div>
                    <Alert
                        type="error"
                        showIcon
                        message="Ссылка недействительна"
                        description="Токен для сброса пароля не найден. Запросите сброс заново."
                        style={{ marginBottom: 16 }}
                    />
                    <div className="auth-footer">
                        <a href="/forgot-password" className="auth-link">Запросить сброс пароля</a>
                    </div>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="login-container">
                <div className="auth-card">
                    <img src="/logo50.png" alt="Threadly" className="auth-logo" />
                    <div className="auth-title">Пароль изменён</div>
                    <Alert
                        type="success"
                        showIcon
                        message="Успешно"
                        description="Ваш пароль был успешно изменён."
                        style={{ marginBottom: 16 }}
                    />
                    <div className="auth-footer">
                        <a href="/login" className="auth-link">Войти с новым паролем</a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="login-container">
            <div className="auth-card">
                <img src="/logo50.png" alt="Threadly" className="auth-logo" />
                <div className="auth-title">Новый пароль</div>
                <div className="auth-subtitle">Придумайте новый пароль для аккаунта</div>

                <Form
                    name="reset_password"
                    className="login-form"
                    onFinish={onFinish}
                >
                    <Form.Item
                        name="newPassword"
                        rules={[
                            { required: true, message: "Введите новый пароль" },
                            { min: 6, message: "Минимум 6 символов" },
                        ]}
                    >
                        <Input
                            size="large"
                            prefix={<LockOutlined className="site-form-item-icon" />}
                            type="password"
                            placeholder="Новый пароль"
                        />
                    </Form.Item>
                    <Form.Item
                        name="confirmPassword"
                        rules={[
                            { required: true, message: "Повторите пароль" },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue("newPassword") === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error("Пароли не совпадают"));
                                },
                            }),
                        ]}
                    >
                        <Input
                            size="large"
                            prefix={<LockOutlined className="site-form-item-icon" />}
                            type="password"
                            placeholder="Повторите пароль"
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
                            Сменить пароль
                        </Button>
                    </Form.Item>
                    <div className="auth-footer">
                        <a href="/login" className="auth-link">← Вернуться ко входу</a>
                    </div>
                </Form>
            </div>
        </div>
    );
};

export default ResetPassword;
