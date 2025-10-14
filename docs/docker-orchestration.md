# Docker Orchestration and Auto-Scaling

This document describes the Docker container orchestration and auto-scaling functionality implemented in the Mini Data Cloud control plane.

## Overview

The Docker orchestration system provides:

1. **Container Lifecycle Management** - Create, start, stop, and remove worker containers
2. **Auto-Scaling** - Automatically scale workers based on load metrics
3. **Load Balancing** - Distribute queries across available workers using various strategies
4. **Health Monitoring** - Monitor container health and resource usage

## Components

### DockerOrchestrationService

Manages Docker containers for worker scaling and lifecycle management.

**Key Features:**
- Creates worker containers with configurable resource limits
- Monitors container health and status
- Manages Docker networks and volumes
- Provides container discovery and tracking

**Configuration:**
```yaml
minicloud:
  docker:
    worker-image: minicloud-worker:latest
    network: minicloud-network
    data-volume: ./data
    worker-memory: 2g
    worker-cpu: 1.0
```

### ClusterAutoScaler

Implements auto-scaling policies based on cluster load metrics.

**Key Features:**
- Configurable min/max worker limits
- Multiple scaling triggers (CPU, memory, query load)
- Cooldown periods to prevent thrashing
- Manual scaling override capabilities

**Configuration:**
```yaml
minicloud:
  autoscaling:
    enabled: true
    min-workers: 1
    max-workers: 5
    scale-up-threshold: 0.8
    scale-down-threshold: 0.3
    cooldown-minutes: 2
```

**Scaling Triggers:**
- **Scale Up**: CPU > 80%, Memory > 80%, or > 3 queries per worker
- **Scale Down**: CPU < 30%, Memory < 30%, and < 1 query per worker

### LoadBalancingService

Distributes work across available workers using various strategies.

**Load Balancing Strategies:**
- **ROUND_ROBIN**: Distribute requests evenly across workers
- **LEAST_LOADED**: Send requests to worker with lowest load
- **LEAST_CONNECTIONS**: Send requests to worker with fewest active connections
- **RESOURCE_AWARE**: Select worker based on available CPU and memory
- **WEIGHTED_ROUND_ROBIN**: Distribute based on worker capacity weights

## API Endpoints

### Container Management

```bash
# List all managed containers
GET /api/orchestration/containers

# Get specific container info
GET /api/orchestration/containers/{workerId}

# Create new worker container
POST /api/orchestration/containers
{
  "workerId": "worker-1",
  "environmentVariables": {
    "LOG_LEVEL": "DEBUG"
  }
}

# Remove worker container
DELETE /api/orchestration/containers/{workerId}?force=false

# Check container health
GET /api/orchestration/containers/{workerId}/health
```

### Auto-Scaling

```bash
# Get auto-scaling status
GET /api/orchestration/autoscaling/status

# Enable/disable auto-scaling
PUT /api/orchestration/autoscaling/enabled
{
  "enabled": true
}

# Manual scaling
POST /api/orchestration/autoscaling/scale
{
  "targetWorkers": 3,
  "reason": "Manual scaling for load test"
}
```

### Load Balancing

```bash
# Get load balancing statistics
GET /api/orchestration/loadbalancing/stats

# Reset load metrics
POST /api/orchestration/loadbalancing/reset
```

## Docker Requirements

### Prerequisites

1. **Docker Daemon**: Must be running and accessible via Unix socket
2. **Docker Network**: The `minicloud-network` bridge network must exist
3. **Worker Image**: The `minicloud-worker:latest` image must be available
4. **Permissions**: Control plane must have access to Docker socket

### Network Setup

```bash
# Create Docker network for Mini Data Cloud
docker network create minicloud-network

# Verify network exists
docker network ls | grep minicloud
```

### Worker Image

The worker containers are created from the `minicloud-worker:latest` image with:
- Environment variables for configuration
- Network connectivity to control plane
- Shared data volume for file access
- Resource limits (CPU and memory)
- Health check endpoints

## Monitoring and Observability

### Metrics

The orchestration system exposes metrics for:
- Container creation/destruction rates
- Auto-scaling events and decisions
- Load balancing distribution
- Resource utilization across workers

### Health Checks

Container health is monitored through:
- Docker container state (running, stopped, failed)
- Worker heartbeat messages
- Resource usage reporting
- Query execution status

### Logging

Structured logging includes:
- Container lifecycle events
- Auto-scaling decisions and triggers
- Load balancing selections
- Error conditions and recovery

## Integration with Query Execution

The orchestration system integrates with query execution through:

1. **Worker Selection**: Load balancer selects optimal workers for query stages
2. **Resource Tracking**: Monitors active queries per worker
3. **Auto-Scaling**: Scales based on query load and resource usage
4. **Fault Tolerance**: Handles worker failures during query execution

## Example Usage

### Basic Container Management

```java
@Autowired
private DockerOrchestrationService dockerService;

// Create a new worker
WorkerContainer container = dockerService.createWorker("worker-1", Map.of(
    "LOG_LEVEL", "DEBUG",
    "WORKER_MEMORY", "4g"
));

// Check health
ContainerHealthStatus health = dockerService.checkWorkerHealth("worker-1");

// Remove when done
dockerService.removeWorker("worker-1", false);
```

### Auto-Scaling Configuration

```java
@Autowired
private ClusterAutoScaler autoScaler;

// Get current status
AutoScalingStatus status = autoScaler.getAutoScalingStatus();

// Manual scaling
ScalingResult result = autoScaler.scaleToWorkerCount(5, "Load test preparation");

// Enable/disable
autoScaler.setAutoScalingEnabled(true);
```

### Load Balancing

```java
@Autowired
private LoadBalancingService loadBalancer;

// Select worker for new task
Optional<WorkerInfo> worker = loadBalancer.selectWorker(
    LoadBalancingStrategy.RESOURCE_AWARE
);

// Select multiple workers for distributed task
List<WorkerInfo> workers = loadBalancer.selectWorkers(3, 
    LoadBalancingStrategy.LEAST_LOADED
);

// Release load when task completes
loadBalancer.releaseWorkerLoad("worker-1", 1);
```

## Troubleshooting

### Common Issues

1. **Docker Connection Failed**
   - Verify Docker daemon is running
   - Check Docker socket permissions
   - Ensure control plane has access to `/var/run/docker.sock`

2. **Worker Containers Not Starting**
   - Check worker image availability
   - Verify network configuration
   - Review container logs for startup errors

3. **Auto-Scaling Not Working**
   - Verify auto-scaling is enabled
   - Check cooldown period settings
   - Review scaling thresholds and current metrics

4. **Load Balancing Issues**
   - Ensure workers are registered and healthy
   - Check worker resource reporting
   - Verify load metrics are being tracked

### Debug Commands

```bash
# Check Docker system info
curl http://localhost:8080/api/orchestration/system/info

# List all containers
curl http://localhost:8080/api/orchestration/containers

# Get auto-scaling status
curl http://localhost:8080/api/orchestration/autoscaling/status

# Get load balancing stats
curl http://localhost:8080/api/orchestration/loadbalancing/stats
```