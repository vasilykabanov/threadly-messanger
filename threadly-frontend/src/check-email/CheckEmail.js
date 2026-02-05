import React, { useState } from "react";
import { Button, Input, notification } from "antd";
import { MailOutlined } from "@ant-design/icons";
import { resendVerification } from "../util/ApiUtil";
import "./CheckEmail.css";

const CheckEmail = (props) => {
    const [loading, setLoading] = useState(false);
    const [emailInput, setEmailInput] = useState("");

    const params = new URLSearchParams(props.location.search);
    const emailFromUrl = params.get("email") || "";
    const email = emailFromUrl || emailInput;
    const hasEmailInUrl = !!emailFromUrl;

    const handleResend = () => {
        const emailToUse = hasEmailInUrl ? emailFromUrl : emailInput.trim();
        if (!emailToUse) {
            notification.error({
                message: "Ошибка",
                description: "Введите email",
            });
            return;
        }

        setLoading(true);
        resendVerification(emailToUse)
            .then(() => {
                notification.success({
                    message: "Отправлено",
                    description: "Письмо с ссылкой для подтверждения отправлено. Проверьте почту.",
                });
                if (!hasEmailInUrl) {
                    setEmailInput("");
                    props.history.push("/check-email?email=" + encodeURIComponent(emailToUse));
                }
            })
            .catch((error) => {
                notification.error({
                    message: "Ошибка",
                    description: error.message || "Не удалось отправить письмо",
                });
            })
            .finally(() => {
                setLoading(false);
            });
    };

    const goToLogin = () => {
        props.history.push("/login");
    };

    return (
        <div className="check-email-container">
            <div className="check-email-card">
                <img src="/logo50.png" alt="Threadly" className="check-email-logo" />

                <MailOutlined className="check-email-icon" />

                <div className="check-email-title">
                    {hasEmailInUrl ? "Проверьте почту" : "Подтверждение email"}
                </div>

                {hasEmailInUrl ? (
                    <>
                        <div className="check-email-message">
                            Мы отправили письмо с ссылкой для подтверждения на
                            <div className="check-email-address">{emailFromUrl}</div>
                        </div>
                        <div className="check-email-hint">
                            Перейдите по ссылке в письме, чтобы активировать аккаунт.
                            Если письмо не пришло, проверьте папку «Спам».
                        </div>
                    </>
                ) : (
                    <>
                        <div className="check-email-message">
                            Введите email вашего аккаунта — мы отправим ссылку для подтверждения.
                            <br />
                            Если при регистрации указали неверный email, вы можете{" "}
                            <a
                                className="check-email-link"
                                onClick={() => props.history.push("/update-email")}
                            >
                                обновить email здесь
                            </a>.
                        </div>
                        <Input
                            size="large"
                            type="email"
                            placeholder="Email"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            className="check-email-input"
                        />
                    </>
                )}

                <Button
                    type="primary"
                    shape="round"
                    size="large"
                    className="check-email-resend"
                    loading={loading}
                    onClick={handleResend}
                >
                    {hasEmailInUrl ? "Отправить письмо повторно" : "Отправить письмо"}
                </Button>

                <div className="check-email-footer">
                    Уже подтвердили? <a onClick={goToLogin}>Войти</a>
                </div>
            </div>
        </div>
    );
};

export default CheckEmail;
