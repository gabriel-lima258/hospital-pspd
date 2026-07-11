# Multi-stage: compila o bootJar no monorepo (contexto = raiz do repo) e roda num JRE slim.
FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /workspace
COPY gradlew settings.gradle build.gradle gradle.properties ./
COPY gradle ./gradle
COPY proto ./proto
COPY services ./services
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon :services:authorization:bootJar

FROM eclipse-temurin:21-jre-jammy
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
# OpenTelemetry Java agent (auto-instrumenta HTTP/gRPC/JDBC). Sempre carregado, INERTE por default
# (OTEL_SDK_DISABLED=true) — só exporta quando `make tracing` liga.
ADD https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v2.11.0/opentelemetry-javaagent.jar /otel-agent.jar
ENV OTEL_SDK_DISABLED=true \
    OTEL_SERVICE_NAME=authorization \
    OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo.monitoring.svc.cluster.local:4317 \
    OTEL_EXPORTER_OTLP_PROTOCOL=grpc \
    OTEL_METRICS_EXPORTER=none \
    OTEL_LOGS_EXPORTER=none \
    OTEL_TRACES_SAMPLER=parentbased_always_on
COPY --from=build /workspace/services/authorization/build/libs/app.jar /app.jar
ENTRYPOINT ["java","-javaagent:/otel-agent.jar","-jar","/app.jar"]
