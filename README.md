# Mini Data Cloud

A containerized distributed data processing system that demonstrates core cloud database concepts through hands-on implementation.

## Architecture

The Mini Data Cloud is a distributed data processing system with clear separation between control and execution concerns:

### Control Plane
- **Query Management**: SQL parsing with Apache Calcite, query validation, and execution orchestration
- **Metadata Service**: Table registry, schema management, and namespace organization
- **Data Loading**: CSV to Parquet conversion with automatic schema inference
- **REST API**: Comprehensive endpoints for queries, data loading, and metadata operations

### Data Plane (Planned)
- **Query Execution**: Arrow-based columnar processing with vectorized operations
- **Storage Access**: Parquet file reading and Iceberg table operations
- **Distributed Processing**: Worker node coordination via gRPC communication

### Current Implementation Status
- ✅ **Control Plane**: Fully functional with REST APIs, SQL parsing, and metadata management
- ✅ **Data Loading**: CSV to Parquet conversion with automatic table registration
- ✅ **Query Processing**: Basic SQL execution with mock results (Arrow integration in progress)
- ❌ **Distributed Execution**: Single-node operation (multi-worker planned)
- ❌ **Iceberg Integration**: File-based storage (ACID transactions planned)

## Technology Stack

- **Java 17** with Spring Boot for application framework
- **Apache Calcite** for SQL parsing and query optimization
- **Apache Arrow** for columnar in-memory processing
- **Apache Iceberg** for table format with ACID transactions
- **gRPC** for inter-service communication
- **Docker** for containerization and orchestration

## Quick Start

### Prerequisites

- Java 17+
- Maven 3.8+
- Docker and Docker Compose

### Build and Run

1. **Build the project:**
   ```bash
   mvn clean install -DskipTests
   ```

2. **Run locally for development:**
   ```bash
   # Start control plane (Terminal 1)
   cd minicloud-control-plane
   mvn spring-boot:run
   
   # Start worker (Terminal 2)
   cd minicloud-worker
   WORKER_ID=worker-1 mvn spring-boot:run
   ```

3. **Verify services are running:**
   ```bash
   # Control Plane health check
   curl http://localhost:8080/actuator/health
   
   # Worker health check
   curl http://localhost:8081/actuator/health
   ```

4. **Load sample data and run queries:**
   ```bash
   # Load sample bank transactions
   curl -X POST http://localhost:8080/api/v1/data/load/sample/bank-transactions
   
   # Run a SQL query
   curl -X POST http://localhost:8080/api/v1/queries \
     -H "Content-Type: application/json" \
     -d '{"sql": "SELECT COUNT(*) FROM bank_transactions"}'
   
   # Check query status (use queryId from previous response)
   curl http://localhost:8080/api/v1/queries/{queryId}
   ```

5. **Test startup automatically:**
   ```bash
   ./test-startup.sh
   ```

### Docker Support

Docker Compose is configured but requires further implementation for full functionality:

```bash
# Will start but with limited functionality
docker-compose up -d
```

## Project Structure

```
mini-data-cloud/
├── proto/                          # Protocol Buffer definitions
├── minicloud-common/               # Shared models and utilities
├── minicloud-control-plane/        # Control plane services
├── minicloud-worker/               # Query execution workers
├── tools/                          # Development and monitoring tools
├── docker-compose.yml              # Development environment
└── README.md
```

## API Endpoints

### Control Plane (Port 8080)

**Health and System:**
- `GET /actuator/health` - Spring Boot health check
- `GET /api/v1/health` - Custom health check with database status
- `GET /api/v1/health/info` - Detailed system information

**Query Management:**
- `POST /api/v1/queries` - Submit SQL query for execution
- `GET /api/v1/queries/{queryId}` - Get query status and details
- `GET /api/v1/queries` - List recent queries (with limit parameter)
- `GET /api/v1/queries/running` - List currently running queries
- `DELETE /api/v1/queries/{queryId}` - Cancel a query
- `POST /api/v1/queries/validate` - Validate SQL syntax without execution
- `POST /api/v1/queries/check-support` - Check if query uses supported features
- `GET /api/v1/queries/stats` - Get query execution statistics
- `GET /api/v1/queries/{queryId}/results` - Get query result data
- `GET /api/v1/queries/{queryId}/results/available` - Check if results are ready

**Data Loading:**
- `POST /api/v1/data/load/csv` - Load CSV file into a table
- `POST /api/v1/data/load/sample/bank-transactions` - Load sample data
- `GET /api/v1/data/tables` - List loaded tables with statistics
- `GET /api/v1/data/tables/{namespace}/{table}/stats` - Get table statistics

**Metadata Management:**
- `GET /api/v1/metadata/tables` - List all tables
- `GET /api/v1/metadata/namespaces/{namespace}/tables` - List tables in namespace
- `GET /api/v1/metadata/namespaces/{namespace}/tables/{table}` - Get table info
- `POST /api/v1/metadata/namespaces/{namespace}/tables/{table}` - Register table
- `DELETE /api/v1/metadata/namespaces/{namespace}/tables/{table}` - Delete table
- `PUT /api/v1/metadata/namespaces/{namespace}/tables/{table}/stats` - Update stats
- `GET /api/v1/metadata/stats` - Get registry statistics

### Workers (Ports 8081, 8083)

- `GET /actuator/health` - Health check

### gRPC Services

- Control Plane: `localhost:9090`
- Worker Arrow Flight: `localhost:8082`, `localhost:8084`

## Development Phases

This project is implemented in phases:

1. **Phase 1**: Single-node SQL engine with embedded components
2. **Phase 2**: Distributed architecture with gRPC communication
3. **Phase 3**: Production features (Iceberg, security, monitoring)

## License

MIT License - see LICENSE file for details.bsequent phases will expand on this foundation to build a comprehensive distributed analytics platform.

---

This implementation lays the foundation for understanding distributed data processing systems. Development is currently in progress for Phase 1 (Milestone 1), which focuses on establishing the core functionality of the control and data plane. Subsequent phases will expand on this foundation to build a comprehensive distributed analytics platform.