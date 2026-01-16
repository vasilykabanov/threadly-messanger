mvn clean package

docker build -t threadly-auth .
docker run -p 8081 threadly-auth

docker build -t threadly-chat .
docker run -p 8080 threadly-chat

npm install
npm start

cd threadly-messanger/
docker compose up --build