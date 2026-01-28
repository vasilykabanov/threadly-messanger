FROM maven:3.9.9-eclipse-temurin-17 AS build
COPY pom.xml .
RUN mvn -B -DskipTests dependency:resolve
COPY src ./src
RUN mvn -B -DskipTests clean package

FROM eclipse-temurin:17-jre-jammy
VOLUME /tmp
EXPOSE 8081
COPY --from=build /target/threadly-auth-0.0.1.jar app.jar
ENTRYPOINT ["java","-Djava.security.egd=file:/dev/./urandom","-jar","/app.jar"]