mvn clean package

docker build -t threadly-auth .
docker run -p 8081 threadly-auth

docker build -t threadly-chat .
docker run -p 8080 threadly-chat

npm install
npm start

cd threadly-messanger/
docker compose up --build

## Push VAPID ключи

Сгенерировать VAPID ключи можно так:

```
npx web-push generate-vapid-keys
```

В результате получите `publicKey` и `privateKey`. Их нужно задать в переменных окружения:

```
PUSH_VAPID_PUBLIC_KEY=...
PUSH_VAPID_PRIVATE_KEY=...
PUSH_VAPID_SUBJECT=mailto:admin@example.com
```