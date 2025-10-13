#!/bin/bash

# Build verification script for Mini Data Cloud (without Docker)

set -e

echo "🔍 Verifying Mini Data Cloud Build Setup..."
echo ""

# Check Java version
echo "1. Checking Java version..."
java -version 2>&1 | head -1
echo ""

# Check Maven version
echo "2. Checking Maven version..."
mvn -version | head -1
echo ""

# Verify project structure
echo "3. Verifying project structure..."
echo "✓ Root POM exists: $([ -f pom.xml ] && echo "YES" || echo "NO")"
echo "✓ Proto definitions: $([ -d proto ] && echo "YES" || echo "NO")"
echo "✓ Common module: $([ -d minicloud-common ] && echo "YES" || echo "NO")"
echo "✓ Control plane module: $([ -d minicloud-control-plane ] && echo "YES" || echo "NO")"
echo "✓ Worker module: $([ -d minicloud-worker ] && echo "YES" || echo "NO")"
echo ""

# Test compilation
echo "4. Testing compilation..."
mvn clean compile -q
echo "✓ Compilation successful"
echo ""

# Test Protocol Buffer generation
echo "5. Testing Protocol Buffer generation..."
if [ -f "minicloud-common/target/generated-sources/protobuf/grpc-java/com/minicloud/proto/execution/QueryExecutionServiceGrpc.java" ]; then
    echo "✓ gRPC stubs generated successfully"
else
    echo "✗ gRPC stubs not found"
    exit 1
fi
echo ""

# Test packaging
echo "6. Testing packaging..."
mvn package -DskipTests -q
echo "✓ Packaging successful"
echo ""

# Verify JAR files
echo "7. Verifying JAR files..."
echo "✓ Control plane JAR: $([ -f minicloud-control-plane/target/minicloud-control-plane-*.jar ] && echo "YES" || echo "NO")"
echo "✓ Worker JAR: $([ -f minicloud-worker/target/minicloud-worker-*.jar ] && echo "YES" || echo "NO")"
echo ""

# Run tests
echo "8. Running tests..."
mvn test -q
echo "✓ All tests passed"
echo ""

echo "🎉 Build setup verification completed successfully!"
echo ""
echo "Project structure created:"
echo "  ├── proto/                    # Protocol Buffer definitions"
echo "  ├── minicloud-common/         # Shared models and gRPC stubs"
echo "  ├── minicloud-control-plane/  # Control plane service"
echo "  ├── minicloud-worker/         # Query execution worker"
echo "  ├── docker-compose.yml        # Development environment"
echo "  └── data/                     # Data directory"
echo ""
echo "Task 1 completed: ✅ Project structure and core interfaces set up"