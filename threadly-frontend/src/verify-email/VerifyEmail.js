import React, { useEffect, useState } from "react";
import { Button, Spin } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { verifyEmail } from "../util/ApiUtil";
import "./VerifyEmail.css";

const VerifyEmail = (props) => {
    const [status, setStatus] = useState("loading"); // loading, success, error
    const [message, setMessage] = useState("");

    useEffect(() => {
        const params = new URLSearchParams(props.location.search);
        const token = params.get("token");

        if (!token) {
            setStatus("error");
            setMessage("Токен подтверждения отсутствует");
            return;
        }

        verifyEmail(token)
            .then(() => {
                setStatus("success");
                setMessage("Email успешно подтверждён!");
            })
            .catch((error) => {
                setStatus("error");
                setMessage(error.message || "Не удалось подтвердить email. Возможно, ссылка устарела.");
            });
    }, [props.location.search]);

    const goToLogin = () => {
        props.history.push("/login");
    };

    return (
        <div className="verify-container">
            <div className="verify-card">
                <img src="/logo50.png" alt="Threadly" className="verify-logo" />
                
                {status === "loading" && (
                    <>
                        <Spin size="large" />
                        <div className="verify-title">Подтверждение email...</div>
                    </>
                )}

                {status === "success" && (
                    <>
                        <CheckCircleOutlined className="verify-icon success" />
                        <div className="verify-title">Готово!</div>
                        <div className="verify-message">{message}</div>
                        <Button
                            type="primary"
                            shape="round"
                            size="large"
                            className="verify-button"
                            onClick={goToLogin}
                        >
                            Войти в аккаунт
                        </Button>
                    </>
                )}

                {status === "error" && (
                    <>
                        <CloseCircleOutlined className="verify-icon error" />
                        <div className="verify-title">Ошибка</div>
                        <div className="verify-message">{message}</div>
                        <Button
                            type="primary"
                            shape="round"
                            size="large"
                            className="verify-button"
                            onClick={goToLogin}
                        >
                            На страницу входа
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
};

export default VerifyEmail;
