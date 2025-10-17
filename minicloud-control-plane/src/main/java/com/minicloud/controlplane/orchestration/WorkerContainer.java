package com.minicloud.controlplane.orchestration;

/**
 * Represents a worker container managed by the Docker orchestration service.
 */
public class WorkerContainer {
    
    private final String workerId;
    private final String containerId;
    private final String containerName;
    private final String ipAddress;
    private final ContainerStatus status;
    private final long createdAt;
    
    public WorkerContainer(String workerId, String containerId, String containerName, 
                          String ipAddress, ContainerStatus status, long createdAt) {
        this.workerId = workerId;
        this.containerId = containerId;
        this.containerName = containerName;
        this.ipAddress = ipAddress;
        this.status = status;
        this.createdAt = createdAt;
    }
    
    /**
     * Create a new instance with updated status
     */
    public WorkerContainer withStatus(ContainerStatus newStatus) {
        return new WorkerContainer(workerId, containerId, containerName, ipAddress, newStatus, createdAt);
    }
    
    /**
     * Get the gRPC endpoint for this worker
     */
    public String getGrpcEndpoint() {
        return ipAddress + ":9091"; // Default worker gRPC port
    }
    
    // Getters
    public String getWorkerId() { return workerId; }
    public String getContainerId() { return containerId; }
    public String getContainerName() { return containerName; }
    public String getIpAddress() { return ipAddress; }
    public ContainerStatus getStatus() { return status; }
    public long getCreatedAt() { return createdAt; }
    
    @Override
    public String toString() {
        return String.format("WorkerContainer{workerId='%s', containerId='%s', status=%s, ip='%s'}", 
                           workerId, containerId, status, ipAddress);
    }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        WorkerContainer that = (WorkerContainer) o;
        return workerId.equals(that.workerId);
    }
    
    @Override
    public int hashCode() {
        return workerId.hashCode();
    }
}