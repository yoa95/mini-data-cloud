# Multi-stage Dockerfile for Worker
FROM openjdk:17-jdk-slim as base

# Install required packages
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Development stage
FROM base as development
COPY minicloud-worker/target/minicloud-worker-*.jar app.jar
EXPOSE 8081 8082
ENTRYPOINT ["java", "-jar", "app.jar"]

# Production stage
FROM base as production
COPY minicloud-worker/target/minicloud-worker-*.jar app.jar

# JVM tuning for analytical workloads
ENV JAVA_OPTS="-Xmx4g -Xms2g -XX:+UseZGC -XX:MaxDirectMemorySize=8g -XX:+UnlockExperimentalVMOptions"

EXPOSE 8081 8082
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]