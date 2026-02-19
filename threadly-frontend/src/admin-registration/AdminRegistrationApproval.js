import React, { useEffect, useState } from "react";
import { Button, Spin } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { approveRegistration, rejectRegistration } from "../util/ApiUtil";
import "./AdminRegistrationApproval.css";

const AdminRegistrationApproval = (props) => {
    const [status, setStatus] = useState("loading");
    const [message, setMessage] = useState("");

    const isApprove = props.location.pathname.includes("/approve");

    useEffect(() => {
        const params = new URLSearchParams(props.location.search);
        const token = params.get("token");

        if (!token) {
            setStatus("error");
            setMessage("Ссылка недействительна: отсутствует токен.");
            return;
        }

        const request = isApprove ? approveRegistration(token) : rejectRegistration(token);

        request
            .then(() => {
                setStatus("success");
                setMessage(
                    isApprove
                        ? "Регистрация пользователя подтверждена. Он может войти в аккаунт."
                        : "Регистрация пользователя отклонена."
                );
            })
            .catch((error) => {
                setStatus("error");
                setMessage(error.message || "Не удалось выполнить действие. Возможно, ссылка устарела.");
            });
    }, [props.location.search, isApprove]);

    const goToLogin = () => props.history.push("/login");
    const goHome = () => props.history.push("/");

    return (
        <div className="admin-approval-container">
            <div className="admin-approval-card">
                <img src="/logo50.png" alt="Threadly" className="admin-approval-logo" />

                {status === "loading" && (
                    <>
                        <Spin size="large" />
                        <div className="admin-approval-title">
                            {isApprove ? "Подтверждение регистрации..." : "Отклонение регистрации..."}
                        </div>
                    </>
                )}

                {status === "success" && (
                    <>
                        <CheckCircleOutlined className="admin-approval-icon success" />
                        <div className="admin-approval-title">Готово</div>
                        <div className="admin-approval-message">{message}</div>
                        <Button
                            type="primary"
                            shape="round"
                            size="large"
                            className="admin-approval-button"
                            onClick={goHome}
                        >
                            На главную
                        </Button>
                    </>
                )}

                {status === "error" && (
                    <>
                        <CloseCircleOutlined className="admin-approval-icon error" />
                        <div className="admin-approval-title">Ошибка</div>
                        <div className="admin-approval-message">{message}</div>
                        <Button
                            type="primary"
                            shape="round"
                            size="large"
                            className="admin-approval-button"
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

export default AdminRegistrationApproval;
