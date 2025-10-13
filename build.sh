#!/bin/bash

# Build script for Mini Data Cloud

set -e

echo "Building Mini Data Cloud..."

# Clean and compile
echo "1. Cleaning and compiling..."
mvn clean compile

# Generate Protocol Buffer classes
echo "2. Generating Protocol Buffer classes..."
cd minicloud-common
mvn protobuf:compile protobuf:compile-custom
cd ..

# Run tests
echo "3. Running tests..."
mvn test

# Package applications
echo "4. Packaging applications..."
mvn package -DskipTests

# Build Docker images
echo "5. Building Docker images..."
docker build -t minicloud/control-plane:latest -f minicloud-control-plane/Dockerfile minicloud-control-plane/
docker build -t minicloud/worker:latest -f minicloud-worker/Dockerfile minicloud-worker/

echo "Build completed successfully!"
echo ""
echo "To start the development environment:"
echo "  docker-compose up -d"
echo ""
echo "To check service health:"
echo "  curl http://localhost:8080/actuator/health"