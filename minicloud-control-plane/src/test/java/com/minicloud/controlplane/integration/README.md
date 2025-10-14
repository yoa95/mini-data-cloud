# Distributed Execution Integration Tests

This directory contains comprehensive integration tests for the Mini Data Cloud's distributed execution capabilities.

## Test Overview

The integration tests validate the following key requirements:

### Requirements Coverage
- **Requirement 4.2**: Distributed query execution and worker communication
- **Requirement 4.4**: Fault tolerance and worker failure handling

### Test Classes

1. **DistributedExecutionIntegrationTest**
   - Tests basic distributed query execution across multiple workers
   - Validates query distribution and result aggregation
   - Tests concurrent query execution and load balancing
   - Verifies performance metrics collection

2. **QueryAggregationIntegrationTest**
   - Tests various SQL aggregation functions (COUNT, SUM, AVG, MIN, MAX)
   - Validates GROUP BY and HAVING clause processing
   - Tests complex aggregation queries with filtering
   - Verifies result consistency across multiple executions

3. **FaultToleranceIntegrationTest**
   - Tests worker failure scenarios and recovery
   - Validates query retry mechanisms
   - Tests graceful worker shutdown and restart
   - Simulates network partitions and multiple worker failures

4. **DistributedExecutionTestSuite**
   - Runs all integration tests in a coordinated manner
   - Provides a single entry point for comprehensive testing

## Prerequisites

### System Requirements
- Docker daemon running and accessible
- Java 17 or higher
- Maven 3.6 or higher
- At least 4GB available RAM
- At least 2GB available disk space

### Environment Setup
1. Ensure Docker is running:
   ```bash
   docker --version
   docker-compose --version
   ```

2. Build the project:
   ```bash
   mvn clean compile
   ```

3. Ensure test data is available:
   ```bash
   # The tests expect bank_transactions sample data
   # This should be loaded automatically during test setup
   ```

## Running the Tests

### Run All Integration Tests
```bash
# Run the complete test suite
mvn test -Dtest=DistributedExecutionTestSuite

# Or run all integration tests
mvn test -Dtest="*IntegrationTest"
```

### Run Individual Test Classes
```bash
# Test basic distributed execution
mvn test -Dtest=DistributedExecutionIntegrationTest

# Test query aggregation
mvn test -Dtest=QueryAggregationIntegrationTest

# Test fault tolerance
mvn test -Dtest=FaultToleranceIntegrationTest
```

### Run Specific Test Methods
```bash
# Test specific functionality
mvn test -Dtest=DistributedExecutionIntegrationTest#testBasicDistributedQueryExecution
mvn test -Dtest=FaultToleranceIntegrationTest#testWorkerFailureAndRecovery
```

## Test Configuration

### Environment Variables
The tests can be configured using environment variables:

```bash
# Docker configuration
export DOCKER_HOST=unix:///var/run/docker.sock

# Test timeouts
export MINICLOUD_TEST_TIMEOUT=60

# Log levels
export MINICLOUD_LOG_LEVEL=DEBUG
```

### Test Profiles
Tests use the `integration-test` Spring profile with configuration in:
- `src/test/resources/application-integration-test.yml`

### Docker Compose
Tests use the main `docker-compose.yml` file to spin up:
- Control plane service
- Multiple worker services
- PostgreSQL metadata database
- Monitoring services (Prometheus, Grafana)

## Test Data

The tests use sample banking transaction data with the following schema:
```sql
CREATE TABLE bank_transactions (
    id BIGINT PRIMARY KEY,
    category VARCHAR(50),
    amount DECIMAL(10,2),
    description VARCHAR(200),
    transaction_date DATE
);
```

Sample categories include:
- Food & Dining
- Shopping
- Transportation
- Bills & Utilities
- Entertainment

## Expected Test Behavior

### Successful Test Run
- All containers start successfully
- Workers register with control plane
- Queries execute and return correct results
- Worker failures are handled gracefully
- System recovers from failures

### Common Issues and Solutions

1. **Docker Connection Issues**
   ```
   Error: Cannot connect to Docker daemon
   Solution: Ensure Docker is running and accessible
   ```

2. **Port Conflicts**
   ```
   Error: Port already in use
   Solution: Stop conflicting services or change ports in docker-compose.yml
   ```

3. **Memory Issues**
   ```
   Error: Container killed (OOMKilled)
   Solution: Increase Docker memory limits or reduce test concurrency
   ```

4. **Timeout Issues**
   ```
   Error: Test timeout
   Solution: Increase timeout values or check system performance
   ```

## Test Metrics and Validation

### Performance Metrics
- Query execution time (should be < 30 seconds for simple queries)
- Worker registration time (should be < 10 seconds)
- Failure detection time (should be < 30 seconds)
- Recovery time (should be < 60 seconds)

### Correctness Validation
- Aggregation results match expected mathematical properties
- Distributed results equal single-node results
- Retry mechanisms work correctly
- No data loss during worker failures

## Debugging Tests

### Enable Debug Logging
```bash
mvn test -Dtest=DistributedExecutionIntegrationTest -Dlogging.level.com.minicloud=DEBUG
```

### Access Container Logs
```bash
# View control plane logs
docker-compose logs control-plane

# View worker logs
docker-compose logs worker-1 worker-2

# Follow logs in real-time
docker-compose logs -f
```

### Connect to Test Database
```bash
# Connect to PostgreSQL metadata database
docker-compose exec metadata-db psql -U minicloud -d minicloud
```

## Extending the Tests

### Adding New Test Cases
1. Create test methods in existing test classes
2. Follow the naming convention: `test[Functionality][Scenario]()`
3. Use appropriate `@Order` annotations for test sequencing
4. Add proper assertions and logging

### Adding New Test Classes
1. Create new test class in the integration package
2. Add `@SpringBootTest` and `@ActiveProfiles("test")` annotations
3. Add the class to `DistributedExecutionTestSuite`
4. Document the new tests in this README

### Test Data Management
1. Add test data setup in `@BeforeEach` methods
2. Clean up test data in `@AfterEach` methods
3. Use unique identifiers to avoid conflicts between tests

## Continuous Integration

These tests are designed to run in CI/CD environments:

```yaml
# Example GitHub Actions configuration
- name: Run Integration Tests
  run: |
    docker-compose up -d
    mvn test -Dtest=DistributedExecutionTestSuite
    docker-compose down
```

## Performance Benchmarks

Expected performance characteristics:
- Simple COUNT query: < 5 seconds
- GROUP BY query: < 15 seconds
- Complex aggregation: < 30 seconds
- Worker failure recovery: < 60 seconds
- System startup: < 120 seconds

## Troubleshooting Guide

### Test Failures
1. Check Docker daemon status
2. Verify port availability
3. Check system resources (CPU, memory, disk)
4. Review container logs for errors
5. Validate test data integrity

### Performance Issues
1. Increase JVM heap size: `-Xmx4g`
2. Reduce test concurrency
3. Use SSD storage for better I/O performance
4. Ensure adequate network bandwidth

### Container Issues
1. Update Docker images: `docker-compose pull`
2. Clean Docker system: `docker system prune`
3. Restart Docker daemon
4. Check Docker Compose version compatibility