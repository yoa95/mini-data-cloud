package com.minicloud.controlplane.orchestration;

/**
 * Docker system information
 */
public class DockerSystemInfo {
    
    private final String version;
    private final Integer totalContainers;
    private final Integer runningContainers;
    private final Integer stoppedContainers;
    private final Integer totalImages;
    private final Long totalMemory;
    private final Integer cpuCount;
    
    public DockerSystemInfo(String version, Integer totalContainers, Integer runningContainers, 
                           Integer stoppedContainers, Integer totalImages, Long totalMemory, Integer cpuCount) {
        this.version = version;
        this.totalContainers = totalContainers;
        this.runningContainers = runningContainers;
        this.stoppedContainers = stoppedContainers;
        this.totalImages = totalImages;
        this.totalMemory = totalMemory;
        this.cpuCount = cpuCount;
    }
    
    // Getters
    public String getVersion() { return version; }
    public Integer getTotalContainers() { return totalContainers; }
    public Integer getRunningContainers() { return runningContainers; }
    public Integer getStoppedContainers() { return stoppedContainers; }
    public Integer getTotalImages() { return totalImages; }
    public Long getTotalMemory() { return totalMemory; }
    public Integer getCpuCount() { return cpuCount; }
    
    @Override
    public String toString() {
        return String.format("DockerSystemInfo{version='%s', containers=%d/%d, images=%d, memory=%dMB, cpus=%d}", 
                           version, runningContainers, totalContainers, totalImages, 
                           totalMemory != null ? totalMemory / (1024 * 1024) : 0, cpuCount);
    }
}