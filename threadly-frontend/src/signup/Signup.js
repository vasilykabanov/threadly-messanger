import React, {useEffect, useState} from "react";
import {Form, Input, Button, notification} from "antd";
import {signup} from "../util/ApiUtil";
import "./Signup.css";

const Signup = (props) => {
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (localStorage.getItem("accessToken") !== null) {
            props.history.push("/");
        }
    }, []);

    const onFinish = (values) => {
        setLoading(true);
        signup(values)
            .then((response) => {
                notification.success({
                    message: "Успешно",
                    description:
                        "Спасибо! Регистрация прошла успешно. Войдите, чтобы продолжить!",
                });
                props.history.push("/login");
                setLoading(false);
            })
            .catch((error) => {
                notification.error({
                    message: "Ошибка",
                    description:
                        error.message || "Что-то пошло не так. Пожалуйста, попробуйте еще раз!",
                });
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
                <div className="auth-title">Создайте аккаунт</div>
                <div className="auth-subtitle">Заполните данные, чтобы начать</div>
            <Form
                name="normal_login"
                className="login-form"
                initialValues={{remember: true}}
                onFinish={onFinish}
            >
                <Form.Item
                    name="name"
                    rules={[{required: true, message: "Введите имя!"}]}
                >
                    <Input size="large" placeholder="Имя"/>
                </Form.Item>
                <Form.Item
                    name="username"
                    rules={[{required: true, message: "Введите логин!"}]}
                >
                    <Input size="large" placeholder="Логин"/>
                </Form.Item>
                <Form.Item
                    name="email"
                    rules={[{required: true, message: "Введите email!"}]}
                >
                    <Input size="large" placeholder="Email"/>
                </Form.Item>
                <Form.Item
                    name="password"
                    rules={[{required: true, message: "Введите пароль!"}]}
                >
                    <Input size="large" type="password" placeholder="Пароль"/>
                </Form.Item>
                <Form.Item
                    name="profilePicUrl"
                    rules={[
                        {
                            required: true,
                            message: "Введите ссылку на аватар!",
                        },
                    ]}
                >
                    <Input size="large" placeholder="Ссылка на аватар"/>
                </Form.Item>
                <Form.Item>
                    <Button
                        shape="round"
                        size="large"
                        htmlType="submit"
                        className="login-form-button"
                        loading={loading}
                    >
                        Зарегистрироваться
                    </Button>
                </Form.Item>
                <div className="auth-footer">
                    Уже есть аккаунт? <a href="/login">Войти</a>
                </div>
            </Form>
            </div>
        </div>
    );
};

export default Signup;
