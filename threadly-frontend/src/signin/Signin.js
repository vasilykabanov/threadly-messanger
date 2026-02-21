import React, {useEffect, useState} from "react";
import {Form, Input, Button, notification} from "antd";
import {
    UserOutlined,
    LockOutlined,
} from "@ant-design/icons";
import {login} from "../util/ApiUtil";
import "./Signin.css";

const Signin = (props) => {
    const [loading, setLoading] = useState(false);

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
        if (localStorage.getItem("accessToken") !== null) {
            props.history.push("/chat");
        }
    }, []);

    const onFinish = (values) => {
        setLoading(true);
        login(values)
            .then((response) => {
                clearPersistedState();
                localStorage.setItem("accessToken", response.accessToken);
                props.history.push("/chat");
                setLoading(false);
            })
            .catch((error) => {
                if (error.status === 401) {
                    notification.error({
                        message: "Ошибка",
                        description: "Неверный логин или пароль. Попробуйте еще раз!",
                    });
                } else {
                    notification.error({
                        message: "Ошибка",
                        description:
                            error.message || "Что-то пошло не так. Пожалуйста, попробуйте еще раз!",
                    });
                }
                setLoading(false);
            });
    };

    return (
        <div className="login-container">
            <div className="auth-card">
                <img
                    src="/logo50.png" alt="Threadly"
                    className="auth-logo"
                />
                <div className="auth-title">Threadly</div>
                <div className="auth-subtitle">Войдите, чтобы продолжить общение</div>
            <Form
                name="normal_login"
                className="login-form"
                initialValues={{remember: true}}
                onFinish={onFinish}
            >
                <Form.Item
                    name="username"
                    rules={[
                        {required: true, message: "Введите логин!"},
                        {
                            validator: (_, value) => {
                                if (!value) return Promise.resolve();
                                return /^[a-zA-Z0-9_-]+$/.test(value)
                                    ? Promise.resolve()
                                    : Promise.reject(new Error("Разрешены только: a-z, A-Z, 0-9, - и _"));
                            },
                        },
                    ]}
                >
                    <Input
                        size="large"
                        prefix={<UserOutlined className="site-form-item-icon"/>}
                        placeholder="Логин"
                    />
                </Form.Item>
                <Form.Item
                    name="password"
                    rules={[{required: true, message: "Введите пароль!"}]}
                >
                    <Input
                        size="large"
                        prefix={<LockOutlined className="site-form-item-icon"/>}
                        type="password"
                        placeholder="Пароль"
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
                        Войти
                    </Button>
                </Form.Item>
                <div className="auth-footer">
                    Еще нет аккаунта? <a href="/signup">Зарегистрироваться</a>
                    <br />
                    <a href="/forgot-password" style={{marginTop: 8, display: "inline-block"}}>Забыли пароль?</a>
                </div>
            </Form>
            </div>
        </div>
    );
};

export default Signin;
