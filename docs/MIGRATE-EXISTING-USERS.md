# Миграция существующих пользователей (однократно)

Обновляет старых пользователей в БД: `registrationStatus = APPROVED`, `blocked = false`, `emailVerified = true`.

## Вариант 1: скрипт

Подставь имя своей БД auth (то же, что в `MONGODB_AUTH_DATABASE`):

```bash
# с хоста (если mongosh установлен)
mongosh "mongodb://localhost:27017/ИМЯ_БД_AUTH" docs/migrate-existing-users-mongo.js

# из контейнера
docker exec -i mongo-auth mongosh "mongodb://localhost:27017/ИМЯ_БД_AUTH" < docs/migrate-existing-users-mongo.js
```

## Вариант 2: одна команда в mongosh / Compass

Подключись к БД auth и выполни:

```javascript
db.user.updateMany(
  {
    $or: [
      { registrationStatus: { $exists: false } },
      { registrationStatus: null }
    ]
  },
  {
    $set: {
      registrationStatus: "APPROVED",
      blocked: false,
      emailVerified: true
    }
  }
);
```

Проверка количества обновлённых документов: смотреть `modifiedCount` в ответе или выполнить до миграции:

```javascript
db.user.countDocuments({
  $or: [
    { registrationStatus: { $exists: false } },
    { registrationStatus: null }
  ]
});
```
