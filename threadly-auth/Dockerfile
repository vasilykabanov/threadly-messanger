FROM eclipse-temurin:17-jdk-jammy
VOLUME /tmp
EXPOSE 8081
ARG JAR_FILE=target/threadly-auth-0.0.1.jar
ADD ${JAR_FILE} app.jar
ENTRYPOINT ["java","-Djava.security.egd=file:/dev/./urandom","-jar","/app.jar"]