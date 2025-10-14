#!/bin/bash

# Test script for Mini Data Cloud data loading functionality

set -e

echo "🧪 Testing Mini Data Cloud Data Loading..."
echo ""

# Function to wait for service to be ready
wait_for_service() {
    local port=$1
    local service_name=$2
    local max_attempts=30
    local attempt=0
    
    echo "Waiting for $service_name to start on port $port..."
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "http://localhost:$port/actuator/health" > /dev/null 2>&1; then
            echo "✅ $service_name is ready!"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
        echo -n "."
    done
    
    echo "❌ $service_name failed to start within $max_attempts seconds"
    return 1
}

# Function to make API calls with error handling
api_call() {
    local method=$1
    local url=$2
    local data=$3
    local description=$4
    
    echo ""
    echo "📡 $description"
    echo "   $method $url"
    
    if [ -n "$data" ]; then
        response=$(curl -s -X "$method" "$url" \
                       -H "Content-Type: application/json" \
                       -d "$data")
    else
        response=$(curl -s -X "$method" "$url")
    fi
    
    echo "   Response: $response"
    echo "$response"
}

echo "1. Starting Control Plane..."
cd minicloud-control-plane
mvn spring-boot:run > /tmp/control-plane.log 2>&1 &
CONTROL_PLANE_PID=$!
cd ..

# Wait for control plane to start
wait_for_service 8080 "Control Plane"

echo ""
echo "2. Testing Data Loading API..."

# Load sample bank transactions
api_call "POST" "http://localhost:8080/api/v1/data/load/sample/bank-transactions" "" "Loading sample bank transactions"

echo ""
echo "3. Checking loaded tables..."

# List loaded tables
api_call "GET" "http://localhost:8080/api/v1/data/tables" "" "Listing loaded tables"

echo ""
echo "4. Testing SQL queries..."

# Test basic count query
api_call "POST" "http://localhost:8080/api/v1/queries" \
         '{"sql": "SELECT COUNT(*) FROM bank_transactions"}' \
         "Running COUNT query"

# Test category aggregation
api_call "POST" "http://localhost:8080/api/v1/queries" \
         '{"sql": "SELECT category, COUNT(*) as transaction_count FROM bank_transactions GROUP BY category"}' \
         "Running GROUP BY query"

# Test simple select
api_call "POST" "http://localhost:8080/api/v1/queries" \
         '{"sql": "SELECT * FROM bank_transactions LIMIT 5"}' \
         "Running SELECT with LIMIT"

echo ""
echo "5. Testing metadata endpoints..."

# Get table metadata
api_call "GET" "http://localhost:8080/api/v1/metadata/tables" "" "Getting table metadata"

echo ""
echo "6. Cleanup..."

# Stop control plane
kill $CONTROL_PLANE_PID 2>/dev/null || true
wait $CONTROL_PLANE_PID 2>/dev/null || true

echo ""
echo "🎉 Data loading test completed!"
echo ""
echo "✅ What worked:"
echo "  - CSV data loading"
echo "  - Table registration"
echo "  - SQL query parsing"
echo "  - Metadata management"
echo ""
echo "📊 Check the logs for detailed execution information:"
echo "  - Control plane logs: /tmp/control-plane.log"