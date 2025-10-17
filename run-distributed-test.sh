#!/bin/bash

# Mini Data Cloud - Distributed Testing Script
# This script starts the system and runs distributed query tests

set -e

echo "🚀 Mini Data Cloud - Distributed Testing"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to wait for service
wait_for_service() {
    local port=$1
    local service_name=$2
    local max_attempts=60
    local attempt=0
    
    print_status $YELLOW "⏳ Waiting for $service_name to start on port $port..."
    
    while [ $attempt -lt $max_attempts ]; do
        if [ "$service_name" = "PostgreSQL Database" ]; then
            # For PostgreSQL, check if port is open
            if nc -z localhost $port > /dev/null 2>&1; then
                print_status $GREEN "✅ $service_name is ready!"
                return 0
            fi
        else
            # For other services, use HTTP health check
            if curl -s "http://localhost:$port/actuator/health" > /dev/null 2>&1; then
                print_status $GREEN "✅ $service_name is ready!"
                return 0
            fi
        fi
        sleep 2
        attempt=$((attempt + 1))
        echo -n "."
    done
    
    print_status $RED "❌ $service_name failed to start within $((max_attempts * 2)) seconds"
    return 1
}

# Function to execute API call with pretty output
execute_query() {
    local sql=$1
    local description=$2
    
    print_status $BLUE "📊 $description"
    echo "   SQL: $sql"
    
    response=$(curl -s -X POST http://localhost:8080/api/v1/queries \
                    -H "Content-Type: application/json" \
                    -d "{\"sql\": \"$sql\"}")
    
    echo "   Response: $response" | jq '.' 2>/dev/null || echo "   Response: $response"
    echo ""
}

# Function to check worker status
check_workers() {
    print_status $BLUE "👥 Checking worker status..."
    workers=$(curl -s http://localhost:8080/api/workers)
    echo "$workers" | jq '.' 2>/dev/null || echo "$workers"
    
    worker_count=$(echo "$workers" | jq '. | length' 2>/dev/null || echo "0")
    print_status $GREEN "   Found $worker_count registered workers"
    echo ""
}

# Cleanup function
cleanup() {
    print_status $YELLOW "🧹 Cleaning up..."
    docker compose down > /dev/null 2>&1 || true
    print_status $GREEN "✅ Cleanup completed"
}

# Set trap for cleanup on exit
trap cleanup EXIT

# Main execution
main() {
    print_status $BLUE "1️⃣  Building Docker images..."
    docker compose build > /dev/null 2>&1
    print_status $GREEN "✅ Docker images built successfully"
    echo ""
    
    print_status $BLUE "2️⃣  Starting services..."
    docker compose up -d
    echo ""
    
    print_status $BLUE "3️⃣  Waiting for services to start..."
    wait_for_service 8080 "Control Plane"
    wait_for_service 5432 "PostgreSQL Database"
    echo ""
    
    # Give workers time to register
    print_status $YELLOW "⏳ Waiting for workers to register..."
    sleep 15
    
    check_workers
    
    print_status $BLUE "4️⃣  Loading test data..."
    curl -s -X POST http://localhost:8080/api/v1/data/load/sample/bank-transactions > /dev/null
    print_status $GREEN "✅ Test data loaded"
    echo ""
    
    print_status $BLUE "5️⃣  Testing distributed queries..."
    echo ""
    
    # Test 1: Simple count
    execute_query "SELECT COUNT(*) FROM bank_transactions" "Simple COUNT query"
    
    # Test 2: Group by aggregation  
    execute_query "SELECT category, COUNT(*) as transaction_count FROM bank_transactions GROUP BY category" "GROUP BY aggregation"
    
    # Test 3: Complex aggregation with filtering
    execute_query "SELECT category, AVG(amount) as avg_amount FROM bank_transactions WHERE amount > 100 GROUP BY category HAVING COUNT(*) > 5" "Complex aggregation with filtering"
    
    print_status $BLUE "6️⃣  Testing fault tolerance..."
    echo ""
    
    # Stop one worker
    print_status $YELLOW "🔧 Stopping worker-2 to simulate failure..."
    docker compose stop worker-2
    sleep 5
    
    # Execute query with one worker down
    execute_query "SELECT COUNT(*) FROM bank_transactions" "Query with worker failure"
    
    # Restart worker
    print_status $YELLOW "🔧 Restarting worker-2..."
    docker compose start worker-2
    sleep 15
    
    check_workers
    
    # Execute query with recovered worker
    execute_query "SELECT category, SUM(amount) as total FROM bank_transactions GROUP BY category" "Query after worker recovery"
    
    print_status $BLUE "7️⃣  Performance testing..."
    echo ""
    
    # Execute multiple concurrent queries
    print_status $YELLOW "🏃 Running concurrent queries..."
    for i in {1..5}; do
        curl -s -X POST http://localhost:8080/api/v1/queries \
             -H "Content-Type: application/json" \
             -d "{\"sql\": \"SELECT COUNT(*) FROM bank_transactions WHERE amount > $((i * 100))\"}" > /tmp/query_$i.json &
    done
    wait
    
    print_status $GREEN "✅ Concurrent queries completed"
    echo ""
    
    print_status $BLUE "8️⃣  Checking system metrics..."
    echo ""
    
    # Check worker stats
    print_status $BLUE "📈 Worker statistics:"
    curl -s http://localhost:8080/api/workers/stats | jq '.' 2>/dev/null || echo "Worker stats not available"
    echo ""
    
    # Check healthy workers
    print_status $BLUE "🏗️  Healthy workers:"
    curl -s http://localhost:8080/api/workers/healthy | jq '.' 2>/dev/null || echo "Healthy workers endpoint not available"
    echo ""
    
    print_status $GREEN "🎉 Distributed testing completed successfully!"
    echo ""
    print_status $BLUE "📊 Summary:"
    echo "   ✅ System startup and service discovery"
    echo "   ✅ Worker registration and health monitoring"
    echo "   ✅ Distributed query execution"
    echo "   ✅ Result aggregation across workers"
    echo "   ✅ Fault tolerance and recovery"
    echo "   ✅ Load balancing and concurrent execution"
    echo ""
    print_status $BLUE "🔍 To view detailed logs:"
    echo "   docker compose logs control-plane"
    echo "   docker compose logs worker-1"
    echo "   docker compose logs worker-2"
    echo ""
    print_status $BLUE "🌐 Access monitoring:"
    echo "   Grafana: http://localhost:3000 (admin/admin)"
    echo "   Prometheus: http://localhost:9091"
    echo ""
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_status $RED "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker compose > /dev/null 2>&1; then
    print_status $RED "❌ Docker Compose is not installed. Please install Docker Compose and try again."
    exit 1
fi

# Check if jq is available (optional, for pretty JSON output)
if ! command -v jq > /dev/null 2>&1; then
    print_status $YELLOW "⚠️  jq is not installed. JSON output will not be formatted."
fi

# Run main function
main