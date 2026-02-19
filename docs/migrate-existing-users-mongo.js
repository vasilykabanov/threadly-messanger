// Однократная миграция существующих пользователей в MongoDB
// Запуск: в папке проекта выполнить:
//   mongosh "mongodb://localhost:27017/ВАША_БД_AUTH" migrate-existing-users-mongo.js
// или из контейнера:
//   docker exec -i mongo-auth mongosh "mongodb://localhost:27017/ВАША_БД_AUTH" < docs/migrate-existing-users-mongo.js

const result = db.user.updateMany(
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

print("Обновлено пользователей: " + result.modifiedCount);
print("Совпадений по фильтру: " + result.matchedCount);
