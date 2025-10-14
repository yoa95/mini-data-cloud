package com.minicloud.controlplane.controller;

import com.minicloud.controlplane.service.WorkerRegistryService;
import com.minicloud.proto.common.CommonProto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * REST controller for worker management and monitoring.
 * Provides endpoints for viewing worker status and cluster health.
 */
@RestController
@RequestMapping("/api/workers")
public class WorkerController {
    
    private static final Logger logger = LoggerFactory.getLogger(WorkerController.class);
    
    @Autowired
    private WorkerRegistryService workerRegistryService;
    
    /**
     * Get all workers with optional status filter
     */
    @GetMapping
    public ResponseEntity<List<WorkerInfo>> getWorkers(
            @RequestParam(required = false) String status) {
        
        logger.info("Getting workers with status filter: {}", status);
        
        try {
            CommonProto.WorkerStatus statusFilter = null;
            if (status != null && !status.isEmpty()) {
                statusFilter = CommonProto.WorkerStatus.valueOf(status.toUpperCase());
            }
            
            List<CommonProto.WorkerInfo> workers = workerRegistryService.getWorkers(statusFilter);
            List<WorkerInfo> response = workers.stream()
                    .map(this::toWorkerInfo)
                    .collect(Collectors.toList());
            
            return ResponseEntity.ok(response);
            
        } catch (IllegalArgumentException e) {
            logger.error("Invalid status filter: {}", status, e);
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            logger.error("Error getting workers", e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Get a specific worker by ID
     */
    @GetMapping("/{workerId}")
    public ResponseEntity<WorkerInfo> getWorker(@PathVariable String workerId) {
        logger.info("Getting worker: {}", workerId);
        
        try {
            CommonProto.WorkerInfo worker = workerRegistryService.getWorker(workerId);
            
            if (worker != null) {
                return ResponseEntity.ok(toWorkerInfo(worker));
            } else {
                return ResponseEntity.notFound().build();
            }
            
        } catch (Exception e) {
            logger.error("Error getting worker {}", workerId, e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Get cluster statistics
     */
    @GetMapping("/stats")
    public ResponseEntity<ClusterStats> getClusterStats() {
        logger.info("Getting cluster statistics");
        
        try {
            WorkerRegistryService.ClusterStats stats = workerRegistryService.getClusterStats();
            
            ClusterStats response = new ClusterStats(
                    stats.getTotalWorkers(),
                    stats.getHealthyWorkers(),
                    stats.getUnhealthyWorkers(),
                    stats.getDrainingWorkers()
            );
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Error getting cluster statistics", e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Get healthy workers for query scheduling
     */
    @GetMapping("/healthy")
    public ResponseEntity<List<WorkerInfo>> getHealthyWorkers() {
        logger.info("Getting healthy workers");
        
        try {
            List<CommonProto.WorkerInfo> workers = workerRegistryService.getHealthyWorkers();
            List<WorkerInfo> response = workers.stream()
                    .map(this::toWorkerInfo)
                    .collect(Collectors.toList());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Error getting healthy workers", e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    private WorkerInfo toWorkerInfo(CommonProto.WorkerInfo protoWorker) {
        return new WorkerInfo(
                protoWorker.getWorkerId(),
                protoWorker.getEndpoint(),
                protoWorker.getStatus().name(),
                new ResourceInfo(
                        protoWorker.getResources().getCpuCores(),
                        protoWorker.getResources().getMemoryMb(),
                        protoWorker.getResources().getDiskMb(),
                        protoWorker.getResources().getActiveQueries(),
                        protoWorker.getResources().getCpuUtilization(),
                        protoWorker.getResources().getMemoryUtilization()
                ),
                protoWorker.getLastHeartbeat().getSeconds() * 1000 + 
                        protoWorker.getLastHeartbeat().getNanos() / 1_000_000
        );
    }
    
    /**
     * Worker information DTO for REST API
     */
    public static class WorkerInfo {
        private final String workerId;
        private final String endpoint;
        private final String status;
        private final ResourceInfo resources;
        private final long lastHeartbeatMs;
        
        public WorkerInfo(String workerId, String endpoint, String status, 
                         ResourceInfo resources, long lastHeartbeatMs) {
            this.workerId = workerId;
            this.endpoint = endpoint;
            this.status = status;
            this.resources = resources;
            this.lastHeartbeatMs = lastHeartbeatMs;
        }
        
        // Getters
        public String getWorkerId() { return workerId; }
        public String getEndpoint() { return endpoint; }
        public String getStatus() { return status; }
        public ResourceInfo getResources() { return resources; }
        public long getLastHeartbeatMs() { return lastHeartbeatMs; }
    }
    
    /**
     * Resource information DTO for REST API
     */
    public static class ResourceInfo {
        private final int cpuCores;
        private final long memoryMb;
        private final long diskMb;
        private final int activeQueries;
        private final double cpuUtilization;
        private final double memoryUtilization;
        
        public ResourceInfo(int cpuCores, long memoryMb, long diskMb, int activeQueries,
                           double cpuUtilization, double memoryUtilization) {
            this.cpuCores = cpuCores;
            this.memoryMb = memoryMb;
            this.diskMb = diskMb;
            this.activeQueries = activeQueries;
            this.cpuUtilization = cpuUtilization;
            this.memoryUtilization = memoryUtilization;
        }
        
        // Getters
        public int getCpuCores() { return cpuCores; }
        public long getMemoryMb() { return memoryMb; }
        public long getDiskMb() { return diskMb; }
        public int getActiveQueries() { return activeQueries; }
        public double getCpuUtilization() { return cpuUtilization; }
        public double getMemoryUtilization() { return memoryUtilization; }
    }
    
    /**
     * Cluster statistics DTO for REST API
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