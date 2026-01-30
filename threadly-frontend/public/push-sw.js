/* global self */

console.log("[push-sw] Service Worker loaded");

// Активируемся сразу при установке
self.addEventListener("install", (event) => {
  console.log("[push-sw] Installing...");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[push-sw] Activated!");
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  console.log("[push-sw] Push event received!", event);
  
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
    console.log("[push-sw] Push data:", data);
  } catch (e) {
    console.error("[push-sw] Failed to parse push data:", e);
  }

  const senderName = data.senderName || "Threadly";
  const content = data.content || "Новое сообщение";

  const title = senderName;
  const options = {
    body: content,
    icon: "/logo192.png",
    badge: "/logo50.png",
    data: {
      url: "/chat",
      payload: data,
    },
  };

  console.log("[push-sw] Showing notification:", title, options);
  
  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => console.log("[push-sw] Notification shown successfully"))
      .catch((err) => console.error("[push-sw] Failed to show notification:", err))
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || "/chat";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});

