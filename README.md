# Mini Data Cloud

A containerized distributed data processing system that demonstrates core cloud database concepts through hands-on implementation.

## Architecture

The Mini Data Cloud consists of:

- **Control Plane**: Query planning, metadata management, and cluster orchestration
- **Data Plane**: Distributed query execution using Apache Arrow and Iceberg
- **Storage Layer**: Parquet files managed by Apache Iceberg for ACID transactions

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

4. **Test startup automatically:**
   ```bash
   ./test-startup.sh
   ```

### Docker Support

Docker Compose is configured but requires Task 2 implementation for full functionality:

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

- `GET /actuator/health` - Health check
- `GET /actuator/metrics` - Metrics endpoint
- `POST /api/v1/query` - Submit SQL query
- `GET /api/v1/query/{queryId}` - Get query status
- `GET /api/v1/tables` - List tables

### Workers (Ports 8081, 8083)

- `GET /actuator/health` - Health check
- `GET /actuator/metrics` - Metrics endpoint

### gRPC Services

- Control Plane: `localhost:9090`
- Worker Arrow Flight: `localhost:8082`, `localhost:8084`

## Development Phases

This project is implemented in phases:

1. **Phase 1**: Single-node SQL engine with embedded components
2. **Phase 2**: Distributed architecture with gRPC communication
3. **Phase 3**: Production features (Iceberg, security, monitoring)

See the [implementation tasks](.kiro/specs/mini-data-cloud/tasks.md) for detailed development plan.


## License

MIT License - see LICENSE file for details.bsequent phases will expand on this foundation to build a comprehensive distributed analytics platform.

---

This implementation lays the foundation for understanding distributed data processing systems. Development is currently in progress for Phase 1 (Milestone 1), which focuses on establishing the core functionality of the control and data plane. Subsequent phases will expand on this foundation to build a comprehensive distributed analytics platform.