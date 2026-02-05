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

export function verifyEmail(token) {
    return request({
        url: AUTH_SERVICE + "/verify-email?token=" + encodeURIComponent(token),
        method: "GET",
        skipAuthRedirect: true,
    });
}

export function resendVerification(email) {
    return request({
        url: AUTH_SERVICE + "/resend-verification?email=" + encodeURIComponent(email),
        method: "POST",
        skipAuthRedirect: true,
    });
}

export function updateEmailBeforeVerification(payload) {
    return request({
        url: AUTH_SERVICE + "/update-email-before-verification",
        method: "POST",
        body: JSON.stringify(payload),
        skipAuthRedirect: true,
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

export function deleteChat(senderId, recipientId, userId, scope = "me") {
    if (!localStorage.getItem("accessToken")) {
        return Promise.reject("No access token set.");
    }

    const params = new URLSearchParams({userId, scope});
    return request({
        url: CHAT_SERVICE + "/messages/" + senderId + "/" + recipientId + "?" + params.toString(),
        method: "DELETE",
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
    console.log("[Push] ensurePushSubscribed called for userId:", userId);

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        console.log("[Push] ServiceWorker or PushManager not supported");
        return;
    }

    const permission = await Notification.requestPermission();
    console.log("[Push] Permission:", permission);
    if (permission !== "granted") {
        console.log("[Push] Permission not granted, aborting");
        return;
    }

    const reg = await navigator.serviceWorker.register("/push-sw.js");
    console.log("[Push] ServiceWorker registered:", reg);

    // Ждём пока Service Worker станет готовым
    let registration = await navigator.serviceWorker.ready;
    console.log("[Push] ServiceWorker ready, active:", registration.active);

    // Ждём пока состояние станет "activated"
    if (registration.active && registration.active.state !== "activated") {
        console.log("[Push] Waiting for state: activated (current:", registration.active.state + ")");
        await new Promise((resolve) => {
            registration.active.addEventListener("statechange", function handler(e) {
                console.log("[Push] State changed to:", e.target.state);
                if (e.target.state === "activated") {
                    registration.active.removeEventListener("statechange", handler);
                    resolve();
                }
            });
        });
    }

    console.log("[Push] ServiceWorker fully activated");

    // Получаем публичный ключ с сервера
    const {publicKey} = await getVapidPublicKey();
    console.log("[Push] VAPID public key from server:", publicKey);
    if (!publicKey) {
        console.log("[Push] No public key, aborting");
        return;
    }

    // Проверяем существующую подписку
    let subscription = await registration.pushManager.getSubscription();
    console.log("[Push] Existing subscription:", subscription);

    // Если подписка существует, но с другим ключом — отписываемся
    if (subscription) {
        const existingKey = subscription.options?.applicationServerKey;
        const existingKeyBase64 = existingKey ? btoa(String.fromCharCode(...new Uint8Array(existingKey))) : null;
        // Приводим серверный ключ к такому же формату для сравнения
        const serverKeyBase64 = btoa(String.fromCharCode(...urlBase64ToUint8Array(publicKey)));
        
        if (existingKeyBase64 === serverKeyBase64) {
            console.log("[Push] Existing subscription key matches server, reusing");
        } else {
            console.log("[Push] Key mismatch, unsubscribing from old subscription...");
            await subscription.unsubscribe();
            subscription = null;
        }
    }

    if (!subscription) {
        console.log("[Push] Creating new subscription...");
        try {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey),
            });
            console.log("[Push] New subscription created:", subscription);
        } catch (err) {
            console.error("[Push] Failed to create subscription:", err.name, err.message);
            return;
        }
    }

    // Всегда синхронизируем подписку с сервером
    const json = subscription.toJSON();
    console.log("[Push] Syncing subscription with server...");
    await subscribePush({
        userId,
        endpoint: json.endpoint,
        keys: json.keys,
    });

    console.log("[Push] Subscription synced with server:", json.endpoint.substring(0, 50) + "...");
}
