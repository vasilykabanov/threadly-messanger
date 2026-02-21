import React, {useState} from "react";
import {Form, Input, Button, notification, Alert} from "antd";
import {UserOutlined} from "@ant-design/icons";
import {requestPasswordReset} from "../util/ApiUtil";
import "../signin/Signin.css";

const ForgotPassword = (props) => {
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState(null);

    const onFinish = (values) => {
        setLoading(true);
        setSuccessMessage(null);
        requestPasswordReset({loginOrEmail: values.loginOrEmail})
            .then((response) => {
                setSuccessMessage(response.message);
            })
            .catch((error) => {
                const msg =
                    error?.message && !/bad request/i.test(error.message)
                        ? error.message
                        : "Не удалось отправить запрос. Попробуйте еще раз.";
                notification.error({
                    message: "Ошибка",
                    description: msg,
                });
            })
            .finally(() => setLoading(false));
    };

    return (
        <div className="login-container">
            <div className="auth-card">
                <img src="/logo50.png" alt="Threadly" className="auth-logo" />
                <div className="auth-title">Сброс пароля</div>
                <div className="auth-subtitle">
                    Введите логин или email вашего аккаунта
                </div>

                {successMessage ? (
                    <div style={{textAlign: "center", padding: "20px 0"}}>
                        <Alert
                            message={successMessage}
                            type="success"
                            showIcon
                            style={{marginBottom: 16}}
                        />
                        <div className="auth-footer">
                            <a href="/login">Вернуться ко входу</a>
                        </div>
                    </div>
                ) : (
                    <Form
                        name="forgot_password"
                        className="login-form"
                        onFinish={onFinish}
                    >
                        <Form.Item
                            name="loginOrEmail"
                            rules={[
                                {required: true, message: "Введите логин или email!"},
                            ]}
                        >
                            <Input
                                size="large"
                                prefix={<UserOutlined className="site-form-item-icon" />}
                                placeholder="Логин/почта"
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
                                Отправить
                            </Button>
                        </Form.Item>
                        <div className="auth-footer">
                            Вспомнили пароль? <a href="/login">Войти</a>
                        </div>
                    </Form>
                )}
            </div>
        </div>
    );
};

export default ForgotPassword;
