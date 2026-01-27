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

    useEffect(() => {
        if (localStorage.getItem("accessToken") !== null) {
            props.history.push("/");
        }
    }, []);

    const onFinish = (values) => {
        setLoading(true);
        login(values)
            .then((response) => {
                localStorage.setItem("accessToken", response.accessToken);
                props.history.push("/");
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
            <img
                src="/logo50.png" alt="Threadly"
                style={{
                    width: 50,
                    height: 50,
                    marginBottom: 16
                }}
            />
            <Form
                name="normal_login"
                className="login-form"
                initialValues={{remember: true}}
                onFinish={onFinish}
            >
                <Form.Item
                    name="username"
                    rules={[{required: true, message: "Введите логин!"}]}
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
                Еще нет аккаунта? <a href="/signup">Зарегистрироваться</a>
            </Form>
        </div>
    );
};

export default Signin;
