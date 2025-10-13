# Multi-stage Dockerfile for Control Plane
FROM openjdk:17-jdk-slim as base

# Install required packages
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Development stage
FROM base as development
COPY target/minicloud-control-plane-*.jar app.jar
EXPOSE 8080 9090
ENTRYPOINT ["java", "-jar", "app.jar"]

# Production stage
FROM base as production
COPY target/minicloud-control-plane-*.jar app.jar

# JVM tuning for production
ENV JAVA_OPTS="-Xmx2g -Xms1g -XX:+UseZGC -XX:+UnlockExperimentalVMOptions"

EXPOSE 8080 9090
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]