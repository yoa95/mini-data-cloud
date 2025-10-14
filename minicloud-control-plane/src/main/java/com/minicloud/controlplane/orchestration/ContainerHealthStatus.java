package com.minicloud.controlplane.orchestration;

import java.util.Map;

/**
 * Represents the health status of a container
 */
public class ContainerHealthStatus {
    
    private final String workerId;
    private final boolean healthy;
    private final String message;
    private final Map<String, Object> details;
    
    public ContainerHealthStatus(String workerId, boolean healthy, String message, Map<String, Object> details) {
        this.workerId = workerId;
        this.healthy = healthy;
        this.message = message;
        this.details = details;
    }
    
    // Getters
    public String getWorkerId() { return workerId; }
    public boolean isHealthy() { return healthy; }
    public String getMessage() { return message; }
    public Map<String, Object> getDetails() { return details; }
    
    @Override
    public String toString() {
        return String.format("ContainerHealthStatus{workerId='%s', healthy=%s, message='%s'}", 
                           workerId, healthy, message);
    }
}