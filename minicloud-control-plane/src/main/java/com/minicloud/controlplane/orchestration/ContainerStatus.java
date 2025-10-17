package com.minicloud.controlplane.orchestration;

/**
 * Enumeration of possible container states
 */
public enum ContainerStatus {
    STARTING("Container is starting up"),
    RUNNING("Container is running normally"),
    PAUSED("Container is paused"),
    RESTARTING("Container is restarting"),
    STOPPED("Container has stopped normally"),
    FAILED("Container has failed or exited with error"),
    UNKNOWN("Container status is unknown");
    
    private final String description;
    
    ContainerStatus(String description) {
        this.description = description;
    }
    
    public String getDescription() {
        return description;
    }
    
    /**
     * Check if the container is in a healthy running state
     */
    public boolean isHealthy() {
        return this == RUNNING;
    }
    
    /**
     * Check if the container is in a terminal state (stopped or failed)
     */
    public boolean isTerminal() {
        return this == STOPPED || this == FAILED;
    }
    
    /**
     * Check if the container is in a transitional state
     */
    public boolean isTransitional() {
        return this == STARTING || this == RESTARTING;
    }
}