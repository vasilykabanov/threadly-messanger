import React, { useState } from "react";
import { Form, Input, Button, notification, Alert } from "antd";
import { MailOutlined } from "@ant-design/icons";
import { forgotPassword } from "../util/ApiUtil";
import "./ForgotPassword.css";

const ForgotPassword = (props) => {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [maskedEmail, setMaskedEmail] = useState("");

    const onFinish = (values) => {
        setLoading(true);
        setSuccess(false);
        forgotPassword(values.usernameOrEmail)
            .then((response) => {
                setMaskedEmail(response.maskedEmail || "");
                setSuccess(true);
            })
            .catch((error) => {
                notification.error({
                    message: "Ошибка",
                    description:
                        error.message || "Не удалось отправить запрос. Попробуйте снова.",
                });
            })
            .finally(() => setLoading(false));
    };

    return (
        <div className="login-container">
            <div className="auth-card">
                <img src="/logo50.png" alt="Threadly" className="auth-logo" />
                <div className="auth-title">Забыли пароль?</div>
                <div className="auth-subtitle">
                    Введите логин или email, чтобы сбросить пароль
                </div>

                {success && (
                    <Alert
                        type="success"
                        showIcon
                        message="Письмо отправлено"
                        description={
                            maskedEmail
                                ? `Ссылка для сброса пароля отправлена на ${maskedEmail}`
                                : "Если аккаунт существует, письмо будет отправлено"
                        }
                        style={{ marginBottom: 16 }}
                    />
                )}

                <Form
                    name="forgot_password"
                    className="login-form"
                    onFinish={onFinish}
                >
                    <Form.Item
                        name="usernameOrEmail"
                        rules={[
                            { required: true, message: "Введите логин или email" },
                        ]}
                    >
                        <Input
                            size="large"
                            prefix={<MailOutlined className="site-form-item-icon" />}
                            placeholder="Логин или email"
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
                            Отправить ссылку
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

export default ForgotPassword;
