self.addEventListener("push", (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = {title: "Новое сообщение!", body: ""};
    }

    const title = data.title || "Новое сообщение!";
    const options = {
        body: data.body || "",
        icon: "/logo192.png",
        badge: "/logo192.png",
        data: {
            url: data.url || "/chat",
            messageId: data.messageId,
            senderId: data.senderId,
            recipientId: data.recipientId,
        },
        tag: data.messageId || "threadly-message",
        renotify: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = (event.notification && event.notification.data && event.notification.data.url) || "/chat";

    event.waitUntil(
        self.clients.matchAll({type: "window", includeUncontrolled: true}).then((clientsArr) => {
            for (const client of clientsArr) {
                if (client.url.includes(url) && "focus" in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(url);
            }
            return null;
        })
    );
});
