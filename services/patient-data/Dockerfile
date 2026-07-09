# Multi-stage: compila o bootJar no monorepo (contexto = raiz do repo) e roda num JRE slim.
FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /workspace
COPY gradlew settings.gradle build.gradle gradle.properties ./
COPY gradle ./gradle
COPY proto ./proto
COPY services ./services
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon :services:patient-data:bootJar

FROM eclipse-temurin:21-jre-jammy
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY --from=build /workspace/services/patient-data/build/libs/app.jar /app.jar
ENTRYPOINT ["java","-jar","/app.jar"]
