FROM eclipse-temurin:17-jdk-jammy
VOLUME /tmp
EXPOSE 8080
ARG JAR_FILE=target/threadly-chat-0.0.1.jar
ADD ${JAR_FILE} app.jar
ENTRYPOINT ["java","-Djava.security.egd=file:/dev/./urandom","-jar","/app.jar"]