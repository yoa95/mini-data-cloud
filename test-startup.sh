#!/bin/bash

# Test script to verify the applications can start and respond to health checks

set -e

echo "🧪 Testing Mini Data Cloud Startup..."
echo ""

# Function to start an application in background and test health
test_application() {
    local app_name=$1
    local port=$2
    local directory=$3
    
    echo "Starting $app_name..."
    
    # Start the application in background
    cd "$directory"
    mvn spring-boot:run > "/tmp/${app_name}.log" 2>&1 &
    local pid=$!
    cd - > /dev/null
    
    echo "  PID: $pid"
    echo "  Waiting for startup..."
    
    # Wait for the application to start (max 30 seconds)
    local count=0
    while [ $count -lt 30 ]; do
        if curl -s "http://localhost:$port/actuator/health" > /dev/null 2>&1; then
            echo "  ✅ $app_name started successfully on port $port"
            
            # Test the health endpoint
            local health_response=$(curl -s "http://localhost:$port/actuator/health")
            echo "  Health check: $health_response"
            
            # Stop the application
            kill $pid 2>/dev/null || true
            wait $pid 2>/dev/null || true
            echo "  🛑 $app_name stopped"
            return 0
        fi
        sleep 1
        count=$((count + 1))
    done
    
    echo "  ❌ $app_name failed to start within 30 seconds"
    kill $pid 2>/dev/null || true
    wait $pid 2>/dev/null || true
    return 1
}

# Test control plane
echo "1. Testing Control Plane (port 8080)..."
test_application "control-plane" 8080 "minicloud-control-plane"
echo ""

# Test worker
echo "2. Testing Worker (port 8081)..."
test_application "worker" 8081 "minicloud-worker"
echo ""

echo "🎉 All applications tested successfully!"
echo ""
echo "✅ Current Status:"
echo "  - Project structure: Complete"
echo "  - Build system: Working"
echo "  - Protocol Buffers: Generated"
echo "  - Spring Boot apps: Starting successfully"
echo "  - Health endpoints: Responding"
echo ""
echo "❌ Not yet implemented:"
echo "  - SQL query endpoints"
echo "  - gRPC services"
echo "  - Query processing logic"
echo "  - Docker integration"
echo ""
echo "Next: Implement Task 2 to add SQL query functionality"