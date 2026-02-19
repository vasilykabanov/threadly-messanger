# Архитектура определения статуса пользователя (online/offline)

## Текущее решение

### Как определяется online

1. **WebSocket-сессия**  
   При установлении STOMP-сессии (CONNECT с заголовком `userId`) сервер помечает пользователя как `online` и сохраняет `userId` в атрибутах сессии.

2. **Явный heartbeat**  
   Клиент отправляет сообщение на `/app/status` (тело `{ "status": "online" }`):
   - сразу после успешного подключения;
   - каждые **30 секунд** по таймеру;
   - при возврате на вкладку (`visibilitychange` → `document.visibilityState === "visible"`).

   Сервер в обработчике heartbeat берёт `userId` из атрибутов сессии и обновляет `lastSeen`, а при смене статуса с не-online на online — рассылает обновление по `/topic/status`.

3. **TTL по lastSeen**  
   Фоновая задача раз в **45 секунд** проверяет всех с статусом `online`: если `lastSeen` старше **90 секунд**, пользователь переводится в `offline` и рассылается обновление. Так обрабатываются обрывы соединения без корректного disconnect (падение процесса, сеть и т.п.).

### События на клиенте

| Событие | Действие |
|--------|----------|
| Успешный STOMP connect | Заголовок `userId` в CONNECT; после подключения — один раз отправка на `/app/status`, запуск интервала heartbeat 30 с. |
| Каждые 30 с | Отправка на `/app/status` (пока соединение активно). |
| `visibilitychange` → visible | Если соединение активно — один раз отправить `/app/status`. |
| Размонтирование / смена пользователя | Очистка интервала heartbeat, `stompClient.disconnect()`. |
| Ошибка STOMP | Очистка интервала heartbeat, `setIsConnected(false)`. |

Сервер при **SessionDisconnectEvent** вызывает `updateStatus(userId, "offline")` (очистка lastSeen и рассылка).

### Как обновляется lastSeen

- При **connect** и при каждом **heartbeat** (`/app/status`) сервер для данного `userId` обновляет `lastSeen = now` и держит статус `online`.
- При **disconnect** или при срабатывании **TTL** пользователь переводится в `offline`, запись в `lastSeen` для него удаляется (при offline lastSeen не храним).

### Защита от гонок и «зависаний»

- **ConcurrentHashMap** для статусов и lastSeen — без гонок при одновременном heartbeat и TTL.
- **«Зависание» в online** исключено: при отсутствии heartbeat больше 90 с TTL переводит в offline.
- **Утечки сессий**: одна сессия = один userId в атрибутах; при disconnect userId с этой сессии снимается (offline). TTL дополнительно сбрасывает «забытые» online.

### Возможные улучшения

1. **beforeunload / pagehide**  
   Опционально: `navigator.sendBeacon("/api/chat/status/offline")` с телом `{ userId }` для быстрого перевода в offline при закрытии вкладки. Текущая схема (disconnect + TTL) уже даёт корректный результат; beacon — только для ускорения смены статуса.

2. **Авто-reconnect**  
   При обрыве соединения (onError / закрытие сокета) поднимать новое подключение с тем же `userId` и снова вызывать отправку `/app/status` и запуск heartbeat после успешного connect.

3. **Redis + TTL**  
   Для нескольких инстансов приложения хранить статус и lastSeen в Redis с TTL и подписаться на истечение ключа (или проверять TTL по расписанию), чтобы один и тот же пользователь не считался online на разных нодах бесконечно.

4. **Статусы away/busy**  
   Отдельные сообщения с клиента (например, `/app/status` с `status: "away"` / `"busy"`) и учёт их на сервере наряду с online/offline.

## Файлы

- **Backend:** `UserStatusService` (lastSeen, setOnlineFromHeartbeat, TTL-task), `WsController` (`/app/status`), `WebSocketEventListener` (connect/disconnect).
- **Frontend:** `Chat.js` (sendStatusOnline, heartbeat interval, visibilitychange, очистка при disconnect/onError).
