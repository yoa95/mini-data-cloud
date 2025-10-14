package com.minicloud.controlplane.orchestration;

import com.minicloud.controlplane.service.WorkerRegistryService;
import com.minicloud.controlplane.planner.QueryScheduler;
import com.minicloud.proto.common.CommonProto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Auto-scaling service that manages worker container lifecycle based on query load.
 * Implements basic scaling policies with configurable thresholds.
 */
@Service
public class ClusterAutoScaler {
    
    private static final Logger logger = LoggerFactory.getLogger(ClusterAutoScaler.class);
    
    @Autowired
    private DockerOrchestrationService dockerService;
    
    @Autowired
    private WorkerRegistryService workerRegistryService;
    
    @Autowired
    private QueryScheduler queryScheduler;
    
    @Value("${minicloud.autoscaling.enabled:true}")
    private boolean autoScalingEnabled;
    
    @Value("${minicloud.autoscaling.min-workers:1}")
    private int minWorkers;
    
    @Value("${minicloud.autoscaling.max-workers:5}")
    private int maxWorkers;
    
    @Value("${minicloud.autoscaling.scale-up-threshold:0.8}")
    private double scaleUpThreshold;
    
    @Value("${minicloud.autoscaling.scale-down-threshold:0.3}")
    private double scaleDownThreshold;
    
    @Value("${minicloud.autoscaling.cooldown-minutes:2}")
    private int cooldownMinutes;
    
    @Value("${minicloud.autoscaling.worker-startup-timeout:120}")
    private int workerStartupTimeoutSeconds;
    
    private final AtomicInteger workerCounter = new AtomicInteger(1);
    private final Map<String, ScalingEvent> recentScalingEvents = new ConcurrentHashMap<>();
    private Instant lastScalingAction = Instant.now();
    
    @PostConstruct
    public void initialize() {
        logger.info("Initializing cluster auto-scaler - enabled: {}, min: {}, max: {}", 
                   autoScalingEnabled, minWorkers, maxWorkers);
        
        if (autoScalingEnabled) {
            // Ensure minimum workers are running
            ensureMinimumWorkers();
        }
    }
    
    /**
     * Periodic auto-scaling check
     */
    @Scheduled(fixedRate = 30000) // Every 30 seconds
    public void performAutoScaling() {
        if (!autoScalingEnabled) {
            return;
        }
        
        try {
            logger.debug("Performing auto-scaling check");
            
            // Check if we're in cooldown period
            if (isInCooldownPeriod()) {
                logger.debug("Auto-scaling in cooldown period, skipping");
                return;
            }
            
            // Get current cluster state
            ClusterMetrics metrics = collectClusterMetrics();
            logger.debug("Cluster metrics: {}", metrics);
            
            // Make scaling decision
            ScalingDecision decision = makeScalingDecision(metrics);
            
            if (decision.getAction() != ScalingAction.NO_ACTION) {
                logger.info("Auto-scaling decision: {} (reason: {})", decision.getAction(), decision.getReason());
                executeScalingDecision(decision);
                lastScalingAction = Instant.now();
            }
            
        } catch (Exception e) {
            logger.error("Error during auto-scaling check", e);
        }
    }
    
    /**
     * Manually scale the cluster to a specific number of workers
     */
    public ScalingResult scaleToWorkerCount(int targetWorkers, String reason) {
        logger.info("Manual scaling to {} workers - reason: {}", targetWorkers, reason);
        
        if (targetWorkers < minWorkers || targetWorkers > maxWorkers) {
            return new ScalingResult(false, 
                    String.format("Target worker count %d outside allowed range [%d, %d]", 
                                targetWorkers, minWorkers, maxWorkers), 0, 0);
        }
        
        ClusterMetrics metrics = collectClusterMetrics();
        int currentWorkers = metrics.getHealthyWorkers();
        
        if (targetWorkers == currentWorkers) {
            return new ScalingResult(true, "Already at target worker count", currentWorkers, targetWorkers);
        }
        
        try {
            if (targetWorkers > currentWorkers) {
                // Scale up
                int workersToAdd = targetWorkers - currentWorkers;
                for (int i = 0; i < workersToAdd; i++) {
                    String workerId = generateWorkerId();
                    WorkerContainer container = dockerService.createWorker(workerId, Map.of());
                    logger.info("Created worker container: {}", container);
                }
                
                recordScalingEvent(ScalingAction.SCALE_UP, workersToAdd, reason);
                
            } else {
                // Scale down
                int workersToRemove = currentWorkers - targetWorkers;
                List<String> workersToStop = selectWorkersForRemoval(workersToRemove);
                
                for (String workerId : workersToStop) {
                    boolean removed = dockerService.removeWorker(workerId, false);
                    if (removed) {
                        logger.info("Removed worker container: {}", workerId);
                    }
                }
                
                recordScalingEvent(ScalingAction.SCALE_DOWN, workersToRemove, reason);
            }
            
            lastScalingAction = Instant.now();
            return new ScalingResult(true, "Scaling completed successfully", currentWorkers, targetWorkers);
            
        } catch (Exception e) {
            logger.error("Failed to scale cluster", e);
            return new ScalingResult(false, "Scaling failed: " + e.getMessage(), currentWorkers, currentWorkers);
        }
    }
    
    /**
     * Get current auto-scaling status
     */
    public AutoScalingStatus getAutoScalingStatus() {
        ClusterMetrics metrics = collectClusterMetrics();
        
        return new AutoScalingStatus(
                autoScalingEnabled,
                minWorkers,
                maxWorkers,
                metrics.getHealthyWorkers(),
                metrics.getTotalWorkers(),
                isInCooldownPeriod(),
                lastScalingAction,
                new ArrayList<>(recentScalingEvents.values())
        );
    }
    
    /**
     * Enable or disable auto-scaling
     */
    public void setAutoScalingEnabled(boolean enabled) {
        logger.info("Auto-scaling {}", enabled ? "enabled" : "disabled");
        this.autoScalingEnabled = enabled;
        
        if (enabled) {
            ensureMinimumWorkers();
        }
    }
    
    private ClusterMetrics collectClusterMetrics() {
        List<CommonProto.WorkerInfo> allWorkers = workerRegistryService.getWorkers(null);
        List<CommonProto.WorkerInfo> healthyWorkers = workerRegistryService.getHealthyWorkers();
        List<QueryScheduler.QueryExecutionStatus> activeQueries = queryScheduler.getActiveQueries();
        
        // Calculate load metrics
        double totalCpuUsage = healthyWorkers.stream()
                .mapToDouble(w -> w.getResources().getCpuUtilization() * 100.0)
                .average()
                .orElse(0.0);
        
        double totalMemoryUsage = healthyWorkers.stream()
                .mapToDouble(w -> w.getResources().getMemoryUtilization() * 100.0)
                .average()
                .orElse(0.0);
        
        int totalActiveQueries = activeQueries.size();
        double avgQueriesPerWorker = healthyWorkers.isEmpty() ? 0 : 
                (double) totalActiveQueries / healthyWorkers.size();
        
        return new ClusterMetrics(
                allWorkers.size(),
                healthyWorkers.size(),
                totalActiveQueries,
                avgQueriesPerWorker,
                totalCpuUsage,
                totalMemoryUsage
        );
    }
    
    private ScalingDecision makeScalingDecision(ClusterMetrics metrics) {
        int currentWorkers = metrics.getHealthyWorkers();
        
        // Check if we need to scale up
        if (currentWorkers < maxWorkers) {
            // Scale up if CPU/Memory usage is high or too many queries per worker
            if (metrics.getAvgCpuUsage() > scaleUpThreshold * 100 ||
                metrics.getAvgMemoryUsage() > scaleUpThreshold * 100 ||
                metrics.getAvgQueriesPerWorker() > 3.0) {
                
                String reason = String.format("High load - CPU: %.1f%%, Memory: %.1f%%, Queries/Worker: %.1f", 
                                            metrics.getAvgCpuUsage(), metrics.getAvgMemoryUsage(), 
                                            metrics.getAvgQueriesPerWorker());
                
                return new ScalingDecision(ScalingAction.SCALE_UP, 1, reason);
            }
        }
        
        // Check if we need to scale down
        if (currentWorkers > minWorkers) {
            // Scale down if load is consistently low
            if (metrics.getAvgCpuUsage() < scaleDownThreshold * 100 &&
                metrics.getAvgMemoryUsage() < scaleDownThreshold * 100 &&
                metrics.getAvgQueriesPerWorker() < 1.0 &&
                metrics.getTotalActiveQueries() == 0) {
                
                String reason = String.format("Low load - CPU: %.1f%%, Memory: %.1f%%, Queries/Worker: %.1f", 
                                            metrics.getAvgCpuUsage(), metrics.getAvgMemoryUsage(), 
                                            metrics.getAvgQueriesPerWorker());
                
                return new ScalingDecision(ScalingAction.SCALE_DOWN, 1, reason);
            }
        }
        
        return new ScalingDecision(ScalingAction.NO_ACTION, 0, "No scaling needed");
    }
    
    private void executeScalingDecision(ScalingDecision decision) {
        try {
            if (decision.getAction() == ScalingAction.SCALE_UP) {
                for (int i = 0; i < decision.getWorkerCount(); i++) {
                    String workerId = generateWorkerId();
                    WorkerContainer container = dockerService.createWorker(workerId, Map.of());
                    logger.info("Auto-scaled up: created worker {}", container.getWorkerId());
                }
                
            } else if (decision.getAction() == ScalingAction.SCALE_DOWN) {
                List<String> workersToRemove = selectWorkersForRemoval(decision.getWorkerCount());
                
                for (String workerId : workersToRemove) {
                    boolean removed = dockerService.removeWorker(workerId, false);
                    if (removed) {
                        logger.info("Auto-scaled down: removed worker {}", workerId);
                    }
                }
            }
            
            recordScalingEvent(decision.getAction(), decision.getWorkerCount(), decision.getReason());
            
        } catch (Exception e) {
            logger.error("Failed to execute scaling decision: {}", decision, e);
        }
    }
    
    private void ensureMinimumWorkers() {
        ClusterMetrics metrics = collectClusterMetrics();
        int currentWorkers = metrics.getHealthyWorkers();
        
        if (currentWorkers < minWorkers) {
            int workersToAdd = minWorkers - currentWorkers;
            logger.info("Ensuring minimum workers: adding {} workers", workersToAdd);
            
            for (int i = 0; i < workersToAdd; i++) {
                try {
                    String workerId = generateWorkerId();
                    WorkerContainer container = dockerService.createWorker(workerId, Map.of());
                    logger.info("Created minimum worker: {}", container.getWorkerId());
                } catch (Exception e) {
                    logger.error("Failed to create minimum worker", e);
                }
            }
        }
    }
    
    private List<String> selectWorkersForRemoval(int count) {
        List<CommonProto.WorkerInfo> healthyWorkers = workerRegistryService.getHealthyWorkers();
        
        // Select workers with lowest load for removal
        return healthyWorkers.stream()
                .sorted(Comparator.comparingInt(w -> w.getResources().getActiveQueries()))
                .limit(count)
                .map(CommonProto.WorkerInfo::getWorkerId)
                .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
    }
    
    private boolean isInCooldownPeriod() {
        return lastScalingAction.plus(cooldownMinutes, ChronoUnit.MINUTES).isAfter(Instant.now());
    }
    
    private String generateWorkerId() {
        return "auto-worker-" + workerCounter.getAndIncrement();
    }
    
    private void recordScalingEvent(ScalingAction action, int workerCount, String reason) {
        String eventId = UUID.randomUUID().toString();
        ScalingEvent event = new ScalingEvent(eventId, action, workerCount, reason, Instant.now());
        
        recentScalingEvents.put(eventId, event);
        
        // Keep only recent events (last 10)
        if (recentScalingEvents.size() > 10) {
            String oldestEventId = recentScalingEvents.entrySet().stream()
                    .min(Comparator.comparing(e -> e.getValue().getTimestamp()))
                    .map(Map.Entry::getKey)
                    .orElse(null);
            
            if (oldestEventId != null) {
                recentScalingEvents.remove(oldestEventId);
            }
        }
    }
    
    // Data classes
    
    public enum ScalingAction {
        SCALE_UP, SCALE_DOWN, NO_ACTION
    }
    
    public static class ClusterMetrics {
        private final int totalWorkers;
        private final int healthyWorkers;
        private final int totalActiveQueries;
        private final double avgQueriesPerWorker;
        private final double avgCpuUsage;
        private final double avgMemoryUsage;
        
        public ClusterMetrics(int totalWorkers, int healthyWorkers, int totalActiveQueries, 
                            double avgQueriesPerWorker, double avgCpuUsage, double avgMemoryUsage) {
            this.totalWorkers = totalWorkers;
            this.healthyWorkers = healthyWorkers;
            this.totalActiveQueries = totalActiveQueries;
            this.avgQueriesPerWorker = avgQueriesPerWorker;
            this.avgCpuUsage = avgCpuUsage;
            this.avgMemoryUsage = avgMemoryUsage;
        }
        
        // Getters
        public int getTotalWorkers() { return totalWorkers; }
        public int getHealthyWorkers() { return healthyWorkers; }
        public int getTotalActiveQueries() { return totalActiveQueries; }
        public double getAvgQueriesPerWorker() { return avgQueriesPerWorker; }
        public double getAvgCpuUsage() { return avgCpuUsage; }
        public double getAvgMemoryUsage() { return avgMemoryUsage; }
        
        @Override
        public String toString() {
            return String.format("ClusterMetrics{workers=%d/%d, queries=%d (%.1f/worker), cpu=%.1f%%, mem=%.1f%%}", 
                               healthyWorkers, totalWorkers, totalActiveQueries, avgQueriesPerWorker, 
                               avgCpuUsage, avgMemoryUsage);
        }
    }
    
    public static class ScalingDecision {
        private final ScalingAction action;
        private final int workerCount;
        private final String reason;
        
        public ScalingDecision(ScalingAction action, int workerCount, String reason) {
            this.action = action;
            this.workerCount = workerCount;
            this.reason = reason;
        }
        
        public ScalingAction getAction() { return action; }
        public int getWorkerCount() { return workerCount; }
        public String getReason() { return reason; }
        
        @Override
        public String toString() {
            return String.format("ScalingDecision{action=%s, count=%d, reason='%s'}", 
                               action, workerCount, reason);
        }
    }
    
    public static class ScalingResult {
        private final boolean success;
        private final String message;
        private final int previousWorkerCount;
        private final int newWorkerCount;
        
        public ScalingResult(boolean success, String message, int previousWorkerCount, int newWorkerCount) {
            this.success = success;
            this.message = message;
            this.previousWorkerCount = previousWorkerCount;
            this.newWorkerCount = newWorkerCount;
        }
        
        public boolean isSuccess() { return success; }
        public String getMessage() { return message; }
        public int getPreviousWorkerCount() { return previousWorkerCount; }
        public int getNewWorkerCount() { return newWorkerCount; }
    }
    
    public static class ScalingEvent {
        private final String eventId;
        private final ScalingAction action;
        private final int workerCount;
        private final String reason;
        private final Instant timestamp;
        
        public ScalingEvent(String eventId, ScalingAction action, int workerCount, String reason, Instant timestamp) {
            this.eventId = eventId;
            this.action = action;
            this.workerCount = workerCount;
            this.reason = reason;
            this.timestamp = timestamp;
        }
        
        public String getEventId() { return eventId; }
        public ScalingAction getAction() { return action; }
        public int getWorkerCount() { return workerCount; }
        public String getReason() { return reason; }
        public Instant getTimestamp() { return timestamp; }
    }
    
    public static class AutoScalingStatus {
        private final boolean enabled;
        private final int minWorkers;
        private final int maxWorkers;
        private final int currentHealthyWorkers;
        private final int currentTotalWorkers;
        private final boolean inCooldown;
        private final Instant lastScalingAction;
        private final List<ScalingEvent> recentEvents;
        
        public AutoScalingStatus(boolean enabled, int minWorkers, int maxWorkers, 
                               int currentHealthyWorkers, int currentTotalWorkers, 
                               boolean inCooldown, Instant lastScalingAction, 
                               List<ScalingEvent> recentEvents) {
            this.enabled = enabled;
            this.minWorkers = minWorkers;
            this.maxWorkers = maxWorkers;
            this.currentHealthyWorkers = currentHealthyWorkers;
            this.currentTotalWorkers = currentTotalWorkers;
            this.inCooldown = inCooldown;
            this.lastScalingAction = lastScalingAction;
            this.recentEvents = recentEvents;
        }
        
        // Getters
        public boolean isEnabled() { return enabled; }
        public int getMinWorkers() { return minWorkers; }
        public int getMaxWorkers() { return maxWorkers; }
        public int getCurrentHealthyWorkers() { return currentHealthyWorkers; }
        public int getCurrentTotalWorkers() { return currentTotalWorkers; }
        public boolean isInCooldown() { return inCooldown; }
        public Instant getLastScalingAction() { return lastScalingAction; }
        public List<ScalingEvent> getRecentEvents() { return recentEvents; }
    }
}