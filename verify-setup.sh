#!/bin/bash

# Verification script for Mini Data Cloud setup

set -e

echo "🔍 Verifying Mini Data Cloud Setup..."
echo ""

# Check Java version
echo "1. Checking Java version..."
java -version
echo ""

# Check Maven version
echo "2. Checking Maven version..."
mvn -version | head -1
echo ""

# Check Docker version
echo "3. Checking Docker version..."
docker --version
echo ""

# Check Docker Compose version
echo "4. Checking Docker Compose version..."
docker-compose --version
echo ""

# Verify project structure
echo "5. Verifying project structure..."
echo "✓ Root POM exists: $([ -f pom.xml ] && echo "YES" || echo "NO")"
echo "✓ Proto definitions: $([ -d proto ] && echo "YES" || echo "NO")"
echo "✓ Common module: $([ -d minicloud-common ] && echo "YES" || echo "NO")"
echo "✓ Control plane module: $([ -d minicloud-control-plane ] && echo "YES" || echo "NO")"
echo "✓ Worker module: $([ -d minicloud-worker ] && echo "YES" || echo "NO")"
echo "✓ Docker Compose: $([ -f docker-compose.yml ] && echo "YES" || echo "NO")"
echo ""

# Test compilation
echo "6. Testing compilation..."
mvn clean compile -q
echo "✓ Compilation successful"
echo ""

# Test Protocol Buffer generation
echo "7. Testing Protocol Buffer generation..."
if [ -f "minicloud-common/target/generated-sources/protobuf/grpc-java/com/minicloud/proto/execution/QueryExecutionServiceGrpc.java" ]; then
    echo "✓ gRPC stubs generated successfully"
else
    echo "✗ gRPC stubs not found"
    exit 1
fi
echo ""

# Test packaging
echo "8. Testing packaging..."
mvn package -DskipTests -q
echo "✓ Packaging successful"
echo ""

# Verify JAR files
echo "9. Verifying JAR files..."
echo "✓ Control plane JAR: $([ -f minicloud-control-plane/target/minicloud-control-plane-*.jar ] && echo "YES" || echo "NO")"
echo "✓ Worker JAR: $([ -f minicloud-worker/target/minicloud-worker-*.jar ] && echo "YES" || echo "NO")"
echo ""

# Run tests
echo "10. Running tests..."
mvn test -q
echo "✓ All tests passed"
echo ""

echo "🎉 Setup verification completed successfully!"
echo ""
echo "Next steps:"
echo "  1. Start the development environment: docker-compose up -d"
echo "  2. Check service health: curl http://localhost:8080/actuator/health"
echo "  3. View logs: docker-compose logs -f"
echo "  4. Stop services: docker-compose down"