# Mini Data Cloud - Distributed Testing Guide

This guide shows you how to run the full distributed system with containers and test actual distributed queries.

## Prerequisites

1. **Docker & Docker Compose** installed and running
2. **Java 17** installed
3. **Maven 3.6+** installed
4. At least **4GB RAM** available for containers

## Quick Start

### 1. Build the Project

```bash
# Build all modules
mvn clean package -DskipTests

# Build Docker images
docker compose build
```

### 2. Start the Full System

```bash
# Start all services (control plane + 2 workers + database + monitoring)
docker compose up -d

# Check service status
docker compose ps

# View logs
docker compose logs -f control-plane
docker compose logs -f worker-1
docker compose logs -f worker-2
```

### 3. Wait for Services to Start

```bash
# Wait for control plane to be ready
curl -s http://localhost:8080/actuator/health

# Check worker registration
curl -s http://localhost:8080/api/v1/workers
```

### 4. Load Test Data

```bash
# Load sample bank transactions data
curl -X POST http://localhost:8080/api/v1/data/load/sample/bank-transactions

# Verify data is loaded
curl -s http://localhost:8080/api/v1/data/tables
```

### 5. Test Distributed Queries

```bash
# Simple count query (distributed across workers)
curl -X POST http://localhost:8080/api/v1/queries \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT COUNT(*) FROM bank_transactions"}'

# Aggregation query (requires data shuffling)
curl -X POST http://localhost:8080/api/v1/queries \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT category, COUNT(*) as count, AVG(amount) as avg_amount FROM bank_transactions GROUP BY category"}'

# Complex query with filtering and sorting
curl -X POST http://localhost:8080/api/v1/queries \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT category, SUM(amount) as total FROM bank_transactions WHERE amount > 100 GROUP BY category ORDER BY total DESC"}'
```

## Detailed Testing Scenarios

### Scenario 1: Basic Distributed Execution

```bash
# 1. Check worker status
curl -s http://localhost:8080/api/v1/workers | jq '.'

# 2. Execute simple distributed query
curl -X POST http://localhost:8080/api/v1/queries \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT COUNT(*) FROM bank_transactions"}' | jq '.'

# 3. Check query execution logs
docker compose logs control-plane | grep "distributed"
docker compose logs worker-1 | grep "query"
docker compose logs worker-2 | grep "query"
```

### Scenario 2: Query Result Aggregation

```bash
# Execute aggregation query that requires combining results from multiple workers
curl -X POST http://localhost:8080/api/v1/queries \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "SELECT category, COUNT(*) as transaction_count, SUM(amount) as total_amount, AVG(amount) as avg_amount FROM bank_transactions GROUP BY category HAVING COUNT(*) > 10 ORDER BY total_amount DESC"
  }' | jq '.'
```

### Scenario 3: Worker Failure Testing

```bash
# 1. Stop one worker to simulate failure
docker compose stop worker-2

# 2. Execute query (should still work with remaining worker)
curl -X POST http://localhost:8080/api/v1/queries \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT category, COUNT(*) FROM bank_transactions GROUP BY category"}' | jq '.'

# 3. Restart the failed worker
docker compose start worker-2

# 4. Wait for worker to re-register
sleep 10

# 5. Verify worker is back online
curl -s http://localhost:8080/api/v1/workers | jq '.'

# 6. Execute query again (should use both workers)
curl -X POST http://localhost:8080/api/v1/queries \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT COUNT(*) FROM bank_transactions"}' | jq '.'
```

### Scenario 4: Load Balancing and Scaling

```bash
# 1. Execute multiple concurrent queries to test load balancing
for i in {1..5}; do
  curl -X POST http://localhost:8080/api/v1/queries \
    -H "Content-Type: application/json" \
    -d "{\"sql\": \"SELECT category, COUNT(*) FROM bank_transactions WHERE amount > $((i * 50)) GROUP BY category\"}" &
done
wait

# 2. Check load balancing statistics
curl -s http://localhost:8080/api/v1/orchestration/load-balancing/stats | jq '.'

# 3. Scale up workers (add a third worker)
docker compose up -d --scale worker=3

# 4. Verify new worker registration
curl -s http://localhost:8080/api/v1/workers | jq '.'
```

## Monitoring and Debugging

### Service Health Checks

```bash
# Control plane health
curl -s http://localhost:8080/actuator/health | jq '.'

# Worker health (if workers expose health endpoints)
curl -s http://localhost:8081/actuator/health | jq '.'
curl -s http://localhost:8083/actuator/health | jq '.'

# Database connection
curl -s http://localhost:8080/actuator/health/db | jq '.'
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f control-plane
docker compose logs -f worker-1
docker compose logs -f worker-2

# Filter logs for distributed execution
docker compose logs control-plane | grep -i "distributed\|worker\|query"
```

### Monitoring Dashboard

```bash
# Access Grafana dashboard
open http://localhost:3000
# Login: admin/admin

# Access Prometheus metrics
open http://localhost:9091
```

### Database Access

```bash
# Connect to PostgreSQL metadata database
docker compose exec metadata-db psql -U minicloud -d minicloud

# View worker registrations
# SELECT * FROM worker_registrations;

# View query history
# SELECT * FROM query_executions;
```

## Integration Test Execution

### Run Integration Tests with Real Containers

```bash
# 1. Enable real container testing in integration tests
# Edit: minicloud-control-plane/src/test/java/com/minicloud/controlplane/integration/DistributedExecutionIntegrationTest.java
# Set: static boolean useRealContainers = true;

# 2. Run integration tests
mvn test -Dtest=DistributedExecutionIntegrationTest

# 3. Run specific test scenarios
mvn test -Dtest=DistributedExecutionIntegrationTest#testBasicDistributedQueryExecution
mvn test -Dtest=FaultToleranceIntegrationTest#testWorkerFailureAndRecovery
mvn test -Dtest=QueryAggregationIntegrationTest#testComplexAggregationWithHaving
```

### Run Test Suite

```bash
# Run the complete integration test suite
mvn test -Dtest=DistributedExecutionTestSuite
```

## Performance Testing

### Load Testing

```bash
# Create a simple load test script
cat > load_test.sh << 'EOF'
#!/bin/bash
echo "Starting load test..."
for i in {1..50}; do
  curl -X POST http://localhost:8080/api/v1/queries \
    -H "Content-Type: application/json" \
    -d '{"sql": "SELECT category, COUNT(*) FROM bank_transactions GROUP BY category"}' \
    -w "Time: %{time_total}s\n" &
  
  if [ $((i % 10)) -eq 0 ]; then
    wait
    echo "Completed $i queries"
  fi
done
wait
echo "Load test completed!"
EOF

chmod +x load_test.sh
./load_test.sh
```

### Performance Metrics

```bash
# Check query execution times
curl -s http://localhost:8080/actuator/metrics/query.execution.time | jq '.'

# Check worker utilization
curl -s http://localhost:8080/api/v1/orchestration/load-balancing/stats | jq '.'

# Check system resources
docker stats
```

## Troubleshooting

### Common Issues

1. **Services not starting**
   ```bash
   # Check Docker daemon
   docker info
   
   # Check port conflicts
   netstat -tulpn | grep -E ':(8080|9090|5432)'
   
   # Check logs for errors
   docker compose logs control-plane | grep -i error
   ```

2. **Workers not registering**
   ```bash
   # Check network connectivity
   docker compose exec worker-1 ping control-plane
   
   # Check gRPC connectivity
   docker compose exec worker-1 telnet control-plane 9090
   
   # Check worker logs
   docker compose logs worker-1 | grep -i "registration\|error"
   ```

3. **Queries failing**
   ```bash
   # Check table registration
   curl -s http://localhost:8080/api/v1/data/tables
   
   # Check SQL parsing
   docker compose logs control-plane | grep -i "sql\|parsing"
   
   # Verify data loading
   curl -s http://localhost:8080/api/v1/metadata/tables/bank_transactions
   ```

### Debug Mode

```bash
# Start services with debug logging
SPRING_PROFILES_ACTIVE=development,debug docker compose up -d

# Enable SQL query logging
# Add to application.yml:
# logging:
#   level:
#     com.minicloud: DEBUG
#     org.apache.calcite: DEBUG
```

## Cleanup

```bash
# Stop all services
docker compose down

# Remove volumes (clears all data)
docker compose down -v

# Remove images
docker compose down --rmi all

# Clean up test containers
docker system prune -f
```

## Next Steps

1. **Add More Workers**: Scale the system by adding more worker containers
2. **Load Real Data**: Replace sample data with actual datasets
3. **Performance Tuning**: Optimize query execution and resource allocation
4. **Monitoring Setup**: Configure comprehensive monitoring and alerting
5. **Security**: Add authentication and authorization
6. **High Availability**: Implement control plane clustering

## API Reference

### Query Execution
- `POST /api/v1/queries` - Execute SQL query
- `GET /api/v1/queries/{queryId}` - Get query status
- `GET /api/v1/queries/{queryId}/results` - Get query results

### Worker Management
- `GET /api/v1/workers` - List registered workers
- `GET /api/v1/workers/{workerId}` - Get worker details
- `POST /api/v1/workers/{workerId}/health` - Check worker health

### Data Management
- `POST /api/v1/data/load/sample/{dataset}` - Load sample data
- `GET /api/v1/data/tables` - List available tables
- `GET /api/v1/metadata/tables/{tableName}` - Get table metadata

### Orchestration
- `GET /api/v1/orchestration/cluster/status` - Get cluster status
- `GET /api/v1/orchestration/load-balancing/stats` - Get load balancing stats
- `POST /api/v1/orchestration/workers/scale` - Scale worker count

This guide provides everything you need to run and test the distributed Mini Data Cloud system!