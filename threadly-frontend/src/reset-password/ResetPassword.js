import React, {useState, useEffect} from "react";
import {Form, Input, Button, notification, Spin, Alert} from "antd";
import {LockOutlined} from "@ant-design/icons";
import {validateResetToken, confirmPasswordReset} from "../util/ApiUtil";
import "../signin/Signin.css";

const ResetPassword = (props) => {
    const [loading, setLoading] = useState(false);
    const [validating, setValidating] = useState(true);
    const [tokenValid, setTokenValid] = useState(false);
    const [success, setSuccess] = useState(false);

    const params = new URLSearchParams(props.location.search);
    const token = params.get("token");

    useEffect(() => {
        if (!token) {
            setValidating(false);
            setTokenValid(false);
            return;
        }
        validateResetToken(token)
            .then(() => setTokenValid(true))
            .catch(() => setTokenValid(false))
            .finally(() => setValidating(false));
    }, [token]);

    const onFinish = (values) => {
        if (values.newPassword !== values.confirmPassword) {
            notification.error({
                message: "Ошибка",
                description: "Пароли не совпадают!",
            });
            return;
        }

        setLoading(true);
        confirmPasswordReset({token, newPassword: values.newPassword})
            .then(() => {
                setSuccess(true);
                notification.success({
                    message: "Успешно",
                    description: "Пароль успешно изменён!",
                });
            })
            .catch((error) => {
                const msg =
                    error?.message && !/bad request/i.test(error.message)
                        ? error.message
                        : "Не удалось сбросить пароль.";
                notification.error({
                    message: "Ошибка",
                    description: msg,
                });
            })
            .finally(() => setLoading(false));
    };

    if (validating) {
        return (
            <div className="login-container">
                <div className="auth-card" style={{textAlign: "center", padding: 40}}>
                    <Spin size="large" />
                    <p style={{marginTop: 16}}>Проверка ссылки...</p>
                </div>
            </div>
        );
    }

    if (!tokenValid) {
        return (
            <div className="login-container">
                <div className="auth-card">
                    <img src="/logo50.png" alt="Threadly" className="auth-logo" />
                    <div className="auth-title">Ссылка недействительна</div>
                    <Alert
                        message="Ссылка для сброса пароля недействительна или истекла."
                        type="error"
                        showIcon
                        style={{marginBottom: 16}}
                    />
                    <div className="auth-footer">
                        <a href="/forgot-password">Запросить новую ссылку</a>
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
                        message="Ваш пароль успешно изменён!"
                        type="success"
                        showIcon
                        style={{marginBottom: 16}}
                    />
                    <div className="auth-footer">
                        <a href="/login">Войти с новым паролем</a>
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
                <div className="auth-subtitle">Введите новый пароль для вашего аккаунта</div>
                <Form
                    name="reset_password"
                    className="login-form"
                    onFinish={onFinish}
                >
                    <Form.Item
                        name="newPassword"
                        rules={[
                            {required: true, message: "Введите новый пароль!"},
                            {min: 6, max: 20, message: "От 6 до 20 символов"},
                        ]}
                    >
                        <Input.Password
                            size="large"
                            prefix={<LockOutlined className="site-form-item-icon" />}
                            placeholder="Новый пароль"
                        />
                    </Form.Item>
                    <Form.Item
                        name="confirmPassword"
                        dependencies={["newPassword"]}
                        rules={[
                            {required: true, message: "Повторите новый пароль!"},
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
                        <Input.Password
                            size="large"
                            prefix={<LockOutlined className="site-form-item-icon" />}
                            placeholder="Подтвердите пароль"
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
                            Сбросить пароль
                        </Button>
                    </Form.Item>
                </Form>
            </div>
        </div>
    );
};

export default ResetPassword;
