package com.minicloud.controlplane.service;

import com.minicloud.proto.common.CommonProto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Service for managing worker registration, health monitoring, and discovery.
 * Maintains the registry of all workers in the cluster and their current status.
 */
@Service
public class WorkerRegistryService {
    
    private static final Logger logger = LoggerFactory.getLogger(WorkerRegistryService.class);
    
    // Timeout for considering a worker unhealthy (2 minutes without heartbeat)
    private static final long WORKER_TIMEOUT_SECONDS = 120;
    
    // Registry of all workers indexed by worker ID
    private final Map<String, WorkerRegistration> workerRegistry = new ConcurrentHashMap<>();
    
    /**
     * Register a new worker in the cluster
     */
    public String registerWorker(String requestedWorkerId, String endpoint, CommonProto.ResourceInfo resources, Map<String, String> metadata) {
        String workerId = generateWorkerId(requestedWorkerId);
        
        logger.info("Registering worker {} at endpoint {}", workerId, endpoint);
        
        WorkerRegistration registration = new WorkerRegistration(
                workerId,
                endpoint,
                resources,
                metadata,
                Instant.now()
        );
        
        workerRegistry.put(workerId, registration);
        
        logger.info("Worker {} registered successfully. Total workers: {}", workerId, workerRegistry.size());
        
        return workerId;
    }
    
    /**
     * Deregister a worker from the cluster
     */
    public boolean deregisterWorker(String workerId, String reason) {
        logger.info("Deregistering worker {} - reason: {}", workerId, reason);
        
        WorkerRegistration registration = workerRegistry.remove(workerId);
        
        if (registration != null) {
            logger.info("Worker {} deregistered successfully. Total workers: {}", workerId, workerRegistry.size());
            return true;
        } else {
            logger.warn("Attempted to deregister unknown worker: {}", workerId);
            return false;
        }
    }
    
    /**
     * Update worker heartbeat and resource information
     */
    public boolean updateWorkerHeartbeat(String workerId, CommonProto.ResourceInfo resources, Map<String, String> statusMetadata) {
        WorkerRegistration registration = workerRegistry.get(workerId);
        
        if (registration == null) {
            logger.warn("Received heartbeat from unregistered worker: {}", workerId);
            return false;
        }
        
        registration.updateHeartbeat(resources, statusMetadata);
        logger.debug("Updated heartbeat for worker {}", workerId);
        
        return true;
    }
    
    /**
     * Get all workers with optional status filter
     */
    public List<CommonProto.WorkerInfo> getWorkers(CommonProto.WorkerStatus statusFilter) {
        return workerRegistry.values().stream()
                .filter(registration -> statusFilter == null || registration.getStatus() == statusFilter)
                .map(this::toWorkerInfo)
                .collect(Collectors.toList());
    }
    
    /**
     * Get a specific worker by ID
     */
    public CommonProto.WorkerInfo getWorker(String workerId) {
        WorkerRegistration registration = workerRegistry.get(workerId);
        return registration != null ? toWorkerInfo(registration) : null;
    }
    
    /**
     * Get all healthy workers for query scheduling
     */
    public List<CommonProto.WorkerInfo> getHealthyWorkers() {
        return getWorkers(CommonProto.WorkerStatus.HEALTHY);
    }
    
    /**
     * Check if a worker exists and is healthy
     */
    public boolean isWorkerHealthy(String workerId) {
        WorkerRegistration registration = workerRegistry.get(workerId);
        return registration != null && registration.getStatus() == CommonProto.WorkerStatus.HEALTHY;
    }
    
    /**
     * Periodic cleanup of unhealthy workers
     */
    @Scheduled(fixedRate = 60000) // Every minute
    public void cleanupUnhealthyWorkers() {
        Instant cutoff = Instant.now().minus(WORKER_TIMEOUT_SECONDS, ChronoUnit.SECONDS);
        
        List<String> unhealthyWorkers = workerRegistry.entrySet().stream()
                .filter(entry -> entry.getValue().getLastHeartbeat().isBefore(cutoff))
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
        
        for (String workerId : unhealthyWorkers) {
            logger.warn("Marking worker {} as unhealthy due to missed heartbeats", workerId);
            WorkerRegistration registration = workerRegistry.get(workerId);
            if (registration != null) {
                registration.markUnhealthy();
            }
        }
        
        if (!unhealthyWorkers.isEmpty()) {
            logger.info("Marked {} workers as unhealthy", unhealthyWorkers.size());
        }
    }
    
    /**
     * Get cluster statistics
     */
    public ClusterStats getClusterStats() {
        Map<CommonProto.WorkerStatus, Long> statusCounts = workerRegistry.values().stream()
                .collect(Collectors.groupingBy(
                        WorkerRegistration::getStatus,
                        Collectors.counting()
                ));
        
        return new ClusterStats(
                workerRegistry.size(),
                statusCounts.getOrDefault(CommonProto.WorkerStatus.HEALTHY, 0L).intValue(),
                statusCounts.getOrDefault(CommonProto.WorkerStatus.UNHEALTHY, 0L).intValue(),
                statusCounts.getOrDefault(CommonProto.WorkerStatus.DRAINING, 0L).intValue()
        );
    }
    
    private String generateWorkerId(String requestedId) {
        if (requestedId != null && !requestedId.isEmpty() && !workerRegistry.containsKey(requestedId)) {
            return requestedId;
        }
        
        // Generate unique worker ID
        String baseId = requestedId != null && !requestedId.isEmpty() ? requestedId : "worker";
        int counter = 1;
        String workerId = baseId + "-" + counter;
        
        while (workerRegistry.containsKey(workerId)) {
            counter++;
            workerId = baseId + "-" + counter;
        }
        
        return workerId;
    }
    
    private CommonProto.WorkerInfo toWorkerInfo(WorkerRegistration registration) {
        return CommonProto.WorkerInfo.newBuilder()
                .setWorkerId(registration.getWorkerId())
                .setEndpoint(registration.getEndpoint())
                .setStatus(registration.getStatus())
                .setResources(registration.getResources())
                .setLastHeartbeat(com.google.protobuf.Timestamp.newBuilder()
                        .setSeconds(registration.getLastHeartbeat().getEpochSecond())
                        .setNanos(registration.getLastHeartbeat().getNano())
                        .build())
                .build();
    }
    
    /**
     * Internal class to track worker registration information
     */
    private static class WorkerRegistration {
        private final String workerId;
        private final String endpoint;
        private final Map<String, String> metadata;
        private final Instant registrationTime;
        
        private volatile CommonProto.ResourceInfo resources;
        private volatile Instant lastHeartbeat;
        private volatile CommonProto.WorkerStatus status;
        private volatile Map<String, String> statusMetadata;
        
        public WorkerRegistration(String workerId, String endpoint, CommonProto.ResourceInfo resources, 
                                Map<String, String> metadata, Instant registrationTime) {
            this.workerId = workerId;
            this.endpoint = endpoint;
            this.resources = resources;
            this.metadata = metadata;
            this.registrationTime = registrationTime;
            this.lastHeartbeat = registrationTime;
            this.status = CommonProto.WorkerStatus.HEALTHY;
            this.statusMetadata = Map.of();
        }
        
        public void updateHeartbeat(CommonProto.ResourceInfo newResources, Map<String, String> newStatusMetadata) {
            this.resources = newResources;
            this.lastHeartbeat = Instant.now();
            this.statusMetadata = newStatusMetadata != null ? newStatusMetadata : Map.of();
            
            // If worker was unhealthy and now sending heartbeats, mark as healthy
            if (this.status == CommonProto.WorkerStatus.UNHEALTHY) {
                this.status = CommonProto.WorkerStatus.HEALTHY;
            }
        }
        
        public void markUnhealthy() {
            this.status = CommonProto.WorkerStatus.UNHEALTHY;
        }
        
        // Getters
        public String getWorkerId() { return workerId; }
        public String getEndpoint() { return endpoint; }
        public CommonProto.ResourceInfo getResources() { return resources; }
        public Instant getLastHeartbeat() { return lastHeartbeat; }
        public CommonProto.WorkerStatus getStatus() { return status; }
        public Map<String, String> getMetadata() { return metadata; }
        public Map<String, String> getStatusMetadata() { return statusMetadata; }
    }
    
    /**
     * Cluster statistics data class
     */
    public static class ClusterStats {
        private final int totalWorkers;
        private final int healthyWorkers;
        private final int unhealthyWorkers;
        private final int drainingWorkers;
        
        public ClusterStats(int totalWorkers, int healthyWorkers, int unhealthyWorkers, int drainingWorkers) {
            this.totalWorkers = totalWorkers;
            this.healthyWorkers = healthyWorkers;
            this.unhealthyWorkers = unhealthyWorkers;
            this.drainingWorkers = drainingWorkers;
        }
        
        // Getters
        public int getTotalWorkers() { return totalWorkers; }
        public int getHealthyWorkers() { return healthyWorkers; }
        public int getUnhealthyWorkers() { return unhealthyWorkers; }
        public int getDrainingWorkers() { return drainingWorkers; }
    }
}