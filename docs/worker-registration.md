# Worker Registration and Health Monitoring System

This document describes the worker registration and health monitoring system

## Overview

The worker registration system enables distributed workers to register with the control plane, send periodic health reports, and gracefully deregister when shutting down. This provides the foundation for cluster management and query distribution.

## Architecture

### Components

1. **WorkerRegistryService** (Control Plane)

   - Maintains registry of all workers in the cluster
   - Tracks worker health and resource information
   - Provides worker discovery for query scheduling

2. **WorkerManagementServiceImpl** (Control Plane gRPC Service)

   - Handles worker registration/deregistration requests
   - Processes heartbeat messages from workers
   - Exposes worker management operations via gRPC

3. **WorkerRegistrationService** (Worker)

   - Registers worker with control plane on startup
   - Sends periodic heartbeat messages
   - Deregisters worker on graceful shutdown

4. **ControlPlaneClient** (Worker gRPC Client)

   - Provides gRPC client methods for worker management
   - Handles communication with control plane services

5. **WorkerController** (Control Plane REST API)
   - Exposes worker information via REST endpoints
   - Provides cluster statistics and monitoring data

## Protocol

### Worker Registration Flow

1. **Startup Registration**

   ```
   Worker -> Control Plane: RegisterWorkerRequest
   Control Plane -> Worker: RegisterWorkerResponse (with assigned worker ID)
   ```

2. **Periodic Heartbeats**

   ```
   Worker -> Control Plane: HeartbeatRequest (every 30 seconds)
   Control Plane -> Worker: HeartbeatResponse (acknowledgment + instructions)
   ```

3. **Graceful Shutdown**
   ```
   Worker -> Control Plane: DeregisterWorkerRequest
   Control Plane -> Worker: DeregisterWorkerResponse
   ```

### gRPC Service Definition

```protobuf
service WorkerManagementService {
    rpc RegisterWorker(RegisterWorkerRequest) returns (RegisterWorkerResponse);
    rpc DeregisterWorker(DeregisterWorkerRequest) returns (DeregisterWorkerResponse);
    rpc Heartbeat(HeartbeatRequest) returns (HeartbeatResponse);
    rpc ListWorkers(ListWorkersRequest) returns (ListWorkersResponse);
}
```

## Configuration

### Worker Configuration (application.yml)

```yaml
minicloud:
  worker:
    id: ${WORKER_ID:worker-1} # Optional: requested worker ID
  control-plane:
    endpoint: ${CONTROL_PLANE_ENDPOINT:localhost:9090}

grpc:
  server:
    port: 9091 # Worker gRPC port
  client:
    control-plane:
      address: ${minicloud.control-plane.endpoint}
      negotiation-type: plaintext
```

### Control Plane Configuration

```yaml
grpc:
  server:
    port: 9090 # Control plane gRPC port
    enable-reflection: true
```

## Health Monitoring

### Resource Information Tracked

- **CPU Cores**: Number of available CPU cores
- **Memory**: Total and used memory in MB
- **Active Queries**: Number of currently executing queries
- **CPU Utilization**: Current CPU usage percentage
- **Memory Utilization**: Current memory usage percentage

### Health Check Logic

- Workers send heartbeats every 30 seconds
- Control plane marks workers as unhealthy if no heartbeat received for 2 minutes
- Unhealthy workers are excluded from query scheduling
- Workers can recover to healthy status by resuming heartbeats

## REST API Endpoints

### Get All Workers

```
GET /api/workers?status=HEALTHY
```

### Get Specific Worker

```
GET /api/workers/{workerId}
```

### Get Cluster Statistics

```
GET /api/workers/stats
```

### Get Healthy Workers

```
GET /api/workers/healthy
```

## Worker Lifecycle

### 1. Registration

- Worker generates unique ID if not provided
- Determines network endpoint (host:port)
- Collects initial resource information
- Sends registration request to control plane
- Receives assigned worker ID (may differ from requested)

### 2. Active Operation

- Sends heartbeat every 30 seconds with current resource usage
- Processes query execution requests from control plane
- Updates active query count for accurate resource reporting

### 3. Graceful Shutdown

- Receives shutdown signal (SIGTERM, application stop)
- Sends deregistration request with reason
- Waits for acknowledgment before terminating

## Error Handling

### Registration Failures

- Worker retries registration with exponential backoff
- Logs detailed error messages for troubleshooting
- Can be configured to exit on persistent failures

### Heartbeat Failures

- Worker logs heartbeat failures but continues operation
- Control plane marks worker as unhealthy after timeout
- Worker can re-register if needed

### Network Partitions

- Workers continue operating during temporary network issues
- Control plane maintains last known state
- Automatic recovery when connectivity restored

## Monitoring and Observability

### Metrics Exposed

- Total registered workers
- Healthy/unhealthy worker counts
- Worker resource utilization
- Heartbeat success/failure rates

### Logging

- Structured logging with correlation IDs
- Worker registration/deregistration events
- Health status changes
- Error conditions with context

## Testing

The system includes comprehensive unit tests covering:

- Worker registration and deregistration
- Heartbeat processing
- Resource information updates
- Cluster statistics calculation
- Unique ID generation
- Error scenarios

Run tests with:

```bash
mvn test -pl minicloud-control-plane -Dtest=WorkerRegistryServiceTest
```

## Future Enhancements

1. **Auto-scaling**: Automatic worker provisioning based on load
2. **Load Balancing**: Intelligent query distribution based on worker capacity
3. **Fault Tolerance**: Automatic failover and recovery mechanisms
4. **Security**: mTLS authentication and authorization
5. **Metrics**: Prometheus integration for monitoring
