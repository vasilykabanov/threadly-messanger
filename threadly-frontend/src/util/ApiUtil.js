// const AUTH_SERVICE = "http://localhost:8081";
// const CHAT_SERVICE = "http://localhost:8080";
export const AUTH_SERVICE = "/api/auth";
export const CHAT_SERVICE = "/api/chat";

const request = (options) => {
    const headers = new Headers();

    if (options.setContentType !== false) {
        headers.append("Content-Type", "application/json");
    }

    const token = localStorage.getItem("accessToken");

    if (token) {
        headers.append("Authorization", "Bearer " + token);
    }

    const defaults = {headers: headers};
    options = Object.assign({}, defaults, options);

    return fetch(options.url, options).then(async (response) => {
        const json = await response.json().catch(() => ({}));

        if (!response.ok) {
            if (response.status === 401 && token && !options.skipAuthRedirect) {
                localStorage.removeItem("accessToken");
                window.location.href = "/login";
            }

            return Promise.reject({
                status: response.status,
                ...json
            });
        }

        return json;
    });
};

export function login(loginRequest) {
    return request({
        url: AUTH_SERVICE + "/signin",
        method: "POST",
        body: JSON.stringify(loginRequest),
        skipAuthRedirect: true
    });
}

export function signup(signupRequest) {
    return request({
        url: AUTH_SERVICE + "/users",
        method: "POST",
        body: JSON.stringify(signupRequest),
    });
}

export function getCurrentUser() {
    if (!localStorage.getItem("accessToken")) {
        return Promise.reject("No access token set.");
    }

    return request({
        url: AUTH_SERVICE + "/users/me",
        method: "GET",
    });
}

export function getUsers() {
    if (!localStorage.getItem("accessToken")) {
        return Promise.reject("No access token set.");
    }

    return request({
        url: AUTH_SERVICE + "/users/summaries",
        method: "GET",
    });
}

export function getUserSummary(username) {
    if (!localStorage.getItem("accessToken")) {
        return Promise.reject("No access token set.");
    }

    return request({
        url: AUTH_SERVICE + "/users/summary/" + encodeURIComponent(username),
        method: "GET",
    });
}

export function updateProfile(updateProfileRequest) {
    if (!localStorage.getItem("accessToken")) {
        return Promise.reject("No access token set.");
    }

    return request({
        url: AUTH_SERVICE + "/users/me",
        method: "PUT",
        body: JSON.stringify(updateProfileRequest),
    });
}

export function changePassword(changePasswordRequest) {
    if (!localStorage.getItem("accessToken")) {
        return Promise.reject("No access token set.");
    }

    return request({
        url: AUTH_SERVICE + "/users/me/password",
        method: "PUT",
        body: JSON.stringify(changePasswordRequest),
    });
}

export function countNewMessages(senderId, recipientId) {
    if (!localStorage.getItem("accessToken")) {
        return Promise.reject("No access token set.");
    }

    return request({
        url: CHAT_SERVICE + "/messages/" + senderId + "/" + recipientId + "/count",
        method: "GET",
    });
}

export function findChatMessages(senderId, recipientId) {
    if (!localStorage.getItem("accessToken")) {
        return Promise.reject("No access token set.");
    }

    return request({
        url: CHAT_SERVICE + "/messages/" + senderId + "/" + recipientId,
        method: "GET",
    });
}

export function findChatMessage(id) {
    if (!localStorage.getItem("accessToken")) {
        return Promise.reject("No access token set.");
    }

    return request({
        url: CHAT_SERVICE + "/messages/" + id,
        method: "GET",
    });
}

export function getChatContacts(userId) {
    if (!localStorage.getItem("accessToken")) {
        return Promise.reject("No access token set.");
    }

    return request({
        url: CHAT_SERVICE + "/messages/contacts/" + userId,
        method: "GET",
    });
}

// -------------------------
// Web Push
// -------------------------

export function getVapidPublicKey() {
    return request({
        url: CHAT_SERVICE + "/push/vapid-public-key",
        method: "GET",
        skipAuthRedirect: true,
    });
}

export function subscribePush(subscribeRequest) {
    return request({
        url: CHAT_SERVICE + "/push/subscribe",
        method: "POST",
        body: JSON.stringify(subscribeRequest),
    });
}

const urlBase64ToUint8Array = (base64String) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

export async function ensurePushSubscribed(userId) {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const registration = await navigator.serviceWorker.register("/push-sw.js");
    const existing = await registration.pushManager.getSubscription();
    if (existing) return;

    const {publicKey} = await getVapidPublicKey();
    if (!publicKey) return;

    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const json = subscription.toJSON();
    await subscribePush({
        userId,
        endpoint: json.endpoint,
        keys: json.keys,
    });
}
