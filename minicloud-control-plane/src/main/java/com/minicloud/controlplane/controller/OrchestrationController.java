package com.minicloud.controlplane.controller;

import com.minicloud.controlplane.orchestration.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * REST controller for cluster orchestration and container management operations.
 */
@RestController
@RequestMapping("/api/orchestration")
public class OrchestrationController {
    
    private static final Logger logger = LoggerFactory.getLogger(OrchestrationController.class);
    
    @Autowired
    private DockerOrchestrationService dockerService;
    
    @Autowired
    private ClusterAutoScaler autoScaler;
    
    @Autowired
    private LoadBalancingService loadBalancer;
    
    /**
     * Get Docker system information
     */
    @GetMapping("/system/info")
    public ResponseEntity<DockerSystemInfo> getSystemInfo() {
        try {
            DockerSystemInfo info = dockerService.getSystemInfo();
            return ResponseEntity.ok(info);
        } catch (Exception e) {
            logger.error("Failed to get Docker system info", e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * List all managed worker containers
     */
    @GetMapping("/containers")
    public ResponseEntity<List<WorkerContainer>> listContainers() {
        try {
            List<WorkerContainer> containers = dockerService.listWorkerContainers();
            return ResponseEntity.ok(containers);
        } catch (Exception e) {
            logger.error("Failed to list containers", e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Get specific worker container information
     */
    @GetMapping("/containers/{workerId}")
    public ResponseEntity<WorkerContainer> getContainer(@PathVariable String workerId) {
        try {
            Optional<WorkerContainer> container = dockerService.getWorkerContainer(workerId);
            return container.map(ResponseEntity::ok)
                          .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            logger.error("Failed to get container info for worker {}", workerId, e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Create a new worker container
     */
    @PostMapping("/containers")
    public ResponseEntity<WorkerContainer> createContainer(@RequestBody CreateWorkerRequest request) {
        try {
            logger.info("Creating worker container: {}", request.getWorkerId());
            
            WorkerContainer container = dockerService.createWorker(
                    request.getWorkerId(), 
                    request.getEnvironmentVariables()
            );
            
            return ResponseEntity.ok(container);
            
        } catch (Exception e) {
            logger.error("Failed to create worker container", e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Remove a worker container
     */
    @DeleteMapping("/containers/{workerId}")
    public ResponseEntity<Void> removeContainer(@PathVariable String workerId, 
                                              @RequestParam(defaultValue = "false") boolean force) {
        try {
            logger.info("Removing worker container: {} (force: {})", workerId, force);
            
            boolean removed = dockerService.removeWorker(workerId, force);
            
            if (removed) {
                return ResponseEntity.ok().build();
            } else {
                return ResponseEntity.notFound().build();
            }
            
        } catch (Exception e) {
            logger.error("Failed to remove worker container {}", workerId, e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Check health of a worker container
     */
    @GetMapping("/containers/{workerId}/health")
    public ResponseEntity<ContainerHealthStatus> checkContainerHealth(@PathVariable String workerId) {
        try {
            ContainerHealthStatus health = dockerService.checkWorkerHealth(workerId);
            return ResponseEntity.ok(health);
        } catch (Exception e) {
            logger.error("Failed to check container health for worker {}", workerId, e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Get auto-scaling status
     */
    @GetMapping("/autoscaling/status")
    public ResponseEntity<ClusterAutoScaler.AutoScalingStatus> getAutoScalingStatus() {
        try {
            ClusterAutoScaler.AutoScalingStatus status = autoScaler.getAutoScalingStatus();
            return ResponseEntity.ok(status);
        } catch (Exception e) {
            logger.error("Failed to get auto-scaling status", e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Enable or disable auto-scaling
     */
    @PutMapping("/autoscaling/enabled")
    public ResponseEntity<Void> setAutoScalingEnabled(@RequestBody Map<String, Boolean> request) {
        try {
            boolean enabled = request.getOrDefault("enabled", false);
            autoScaler.setAutoScalingEnabled(enabled);
            logger.info("Auto-scaling {}", enabled ? "enabled" : "disabled");
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            logger.error("Failed to set auto-scaling enabled state", e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Manually scale cluster to specific worker count
     */
    @PostMapping("/autoscaling/scale")
    public ResponseEntity<ClusterAutoScaler.ScalingResult> scaleCluster(@RequestBody ScaleClusterRequest request) {
        try {
            logger.info("Manual scaling request: {} workers - {}", request.getTargetWorkers(), request.getReason());
            
            ClusterAutoScaler.ScalingResult result = autoScaler.scaleToWorkerCount(
                    request.getTargetWorkers(), 
                    request.getReason()
            );
            
            if (result.isSuccess()) {
                return ResponseEntity.ok(result);
            } else {
                return ResponseEntity.badRequest().body(result);
            }
            
        } catch (Exception e) {
            logger.error("Failed to scale cluster", e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Get load balancing statistics
     */
    @GetMapping("/loadbalancing/stats")
    public ResponseEntity<LoadBalancingService.LoadBalancingStats> getLoadBalancingStats() {
        try {
            LoadBalancingService.LoadBalancingStats stats = loadBalancer.getLoadBalancingStats();
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            logger.error("Failed to get load balancing stats", e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Reset load balancing metrics
     */
    @PostMapping("/loadbalancing/reset")
    public ResponseEntity<Void> resetLoadBalancingMetrics() {
        try {
            loadBalancer.resetLoadMetrics();
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            logger.error("Failed to reset load balancing metrics", e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    // Request/Response DTOs
    
    public static class CreateWorkerRequest {
        private String workerId;
        private Map<String, String> environmentVariables = Map.of();
        
        public String getWorkerId() { return workerId; }
        public void setWorkerId(String workerId) { this.workerId = workerId; }
        public Map<String, String> getEnvironmentVariables() { return environmentVariables; }
        public void setEnvironmentVariables(Map<String, String> environmentVariables) { 
            this.environmentVariables = environmentVariables; 
        }
    }
    
    public static class ScaleClusterRequest {
        private int targetWorkers;
        private String reason = "Manual scaling request";
        
        public int getTargetWorkers() { return targetWorkers; }
        public void setTargetWorkers(int targetWorkers) { this.targetWorkers = targetWorkers; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
    }
}