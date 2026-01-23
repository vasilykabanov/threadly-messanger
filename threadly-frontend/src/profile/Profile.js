import React, {useEffect, useState} from "react";
import {Card, Avatar, Button, Divider, Form, Input, message} from "antd";
import {useRecoilState} from "recoil";
import {loggedInUser} from "../atom/globalState";
import {changePassword, getCurrentUser, updateProfile} from "../util/ApiUtil";
import "./Profile.css";

const {Meta} = Card;

const Profile = (props) => {
    const [currentUser, setLoggedInUser] = useRecoilState(loggedInUser);
    const [profileForm] = Form.useForm();
    const [passwordForm] = Form.useForm();
    const [savingProfile, setSavingProfile] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);

    useEffect(() => {
        if (localStorage.getItem("accessToken") === null) {
            props.history.push("/login");
        }
        loadCurrentUser();
    }, []);

    useEffect(() => {
        if (!currentUser?.username) return;
        profileForm.setFieldsValue({
            name: currentUser.name,
            username: currentUser.username,
            email: currentUser.email,
            profilePictureUrl: currentUser.profilePicture,
        });
    }, [currentUser?.username, profileForm]);

    const loadCurrentUser = () => {
        getCurrentUser()
            .then((response) => {
                setLoggedInUser(response);
            })
            .catch((error) => {
                console.log(error);
            });
    };

    const logout = () => {
        localStorage.removeItem("accessToken");
        props.history.push("/login");
    };

    const goToChat = () => {
        props.history.push("/chat");
    };

    const onUpdateProfile = (values) => {
        setSavingProfile(true);
        updateProfile(values)
            .then((response) => {
                setLoggedInUser(response);
                message.success("Профиль обновлён");
            })
            .catch((error) => {
                message.error(error?.message || "Не удалось обновить профиль");
            })
            .finally(() => setSavingProfile(false));
    };

    const onChangePassword = (values) => {
        setChangingPassword(true);
        changePassword({
            currentPassword: values.currentPassword,
            newPassword: values.newPassword,
        })
            .then((response) => {
                message.success(response?.message || "Пароль обновлён");
                passwordForm.resetFields();
            })
            .catch((error) => {
                message.error(error?.message || "Не удалось изменить пароль");
            })
            .finally(() => setChangingPassword(false));
    };

    return (
        <div className="profile-container">
            <Card
                style={{width: 520, border: "1px solid #e1e0e0"}}
                actions={[
                    <Button type="primary" danger onClick={logout}>Выйти</Button>,
                    <Button type="default" onClick={goToChat}>К чату</Button>
                ]}
            >
                <Meta
                    avatar={
                        <Avatar src={currentUser.profilePicture} className="user-avatar-circle">
                            {currentUser.name?.[0]?.toUpperCase()}
                        </Avatar>
                    }
                    title={currentUser.name}
                    description={"@" + currentUser.username}
                />

                <Divider>Профиль</Divider>
                <Form
                    form={profileForm}
                    layout="vertical"
                    onFinish={onUpdateProfile}
                    className="profile-form"
                >
                    <Form.Item
                        name="name"
                        label="Имя"
                        rules={[
                            {required: true, message: "Введите имя"},
                            {min: 3, max: 40, message: "От 3 до 40 символов"},
                        ]}
                    >
                        <Input placeholder="Ваше имя"/>
                    </Form.Item>

                    <Form.Item
                        name="username"
                        label="Юзернейм"
                        rules={[
                            {required: true, message: "Введите юзернейм"},
                            {min: 3, max: 15, message: "От 3 до 15 символов"},
                        ]}
                    >
                        <Input placeholder="username"/>
                    </Form.Item>

                    <Form.Item
                        name="email"
                        label="Email"
                        rules={[
                            {required: true, message: "Введите email"},
                            {type: "email", message: "Некорректный email"},
                        ]}
                    >
                        <Input placeholder="email@example.com"/>
                    </Form.Item>

                    <Form.Item
                        name="profilePictureUrl"
                        label="Ссылка на аватар"
                    >
                        <Input placeholder="https://..."/>
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={savingProfile}>
                            Сохранить изменения
                        </Button>
                    </Form.Item>
                </Form>

                <Divider>Смена пароля</Divider>
                <Form
                    form={passwordForm}
                    layout="vertical"
                    onFinish={onChangePassword}
                    className="profile-form"
                >
                    <Form.Item
                        name="currentPassword"
                        label="Текущий пароль"
                        rules={[{required: true, message: "Введите текущий пароль"}]}
                    >
                        <Input.Password placeholder="Текущий пароль"/>
                    </Form.Item>

                    <Form.Item
                        name="newPassword"
                        label="Новый пароль"
                        rules={[
                            {required: true, message: "Введите новый пароль"},
                            {min: 6, max: 20, message: "От 6 до 20 символов"},
                        ]}
                    >
                        <Input.Password placeholder="Новый пароль"/>
                    </Form.Item>

                    <Form.Item
                        name="confirmPassword"
                        label="Повторите новый пароль"
                        dependencies={["newPassword"]}
                        rules={[
                            {required: true, message: "Повторите новый пароль"},
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
                        <Input.Password placeholder="Повторите пароль"/>
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={changingPassword}>
                            Обновить пароль
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default Profile;
