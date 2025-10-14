package com.minicloud.controlplane.orchestration;

import com.minicloud.controlplane.service.WorkerRegistryService;
import com.minicloud.proto.common.CommonProto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

/**
 * Load balancing service that distributes work across available workers.
 * Implements multiple load balancing strategies and tracks worker performance.
 */
@Service
public class LoadBalancingService {
    
    private static final Logger logger = LoggerFactory.getLogger(LoadBalancingService.class);
    
    @Autowired
    private WorkerRegistryService workerRegistryService;
    
    @Autowired
    private DockerOrchestrationService dockerService;
    
    private final AtomicInteger roundRobinCounter = new AtomicInteger(0);
    private final Map<String, WorkerLoadMetrics> workerLoadMetrics = new ConcurrentHashMap<>();
    
    /**
     * Select the best worker for a new task using the specified strategy
     */
    public Optional<CommonProto.WorkerInfo> selectWorker(LoadBalancingStrategy strategy) {
        List<CommonProto.WorkerInfo> availableWorkers = getAvailableWorkers();
        
        if (availableWorkers.isEmpty()) {
            logger.warn("No available workers for load balancing");
            return Optional.empty();
        }
        
        CommonProto.WorkerInfo selectedWorker = switch (strategy) {
            case ROUND_ROBIN -> selectRoundRobin(availableWorkers);
            case LEAST_LOADED -> selectLeastLoaded(availableWorkers);
            case LEAST_CONNECTIONS -> selectLeastConnections(availableWorkers);
            case WEIGHTED_ROUND_ROBIN -> selectWeightedRoundRobin(availableWorkers);
            case RESOURCE_AWARE -> selectResourceAware(availableWorkers);
        };
        
        if (selectedWorker != null) {
            updateWorkerLoad(selectedWorker.getWorkerId(), 1);
            logger.debug("Selected worker {} using {} strategy", selectedWorker.getWorkerId(), strategy);
        }
        
        return Optional.ofNullable(selectedWorker);
    }
    
    /**
     * Select multiple workers for distributed execution
     */
    public List<CommonProto.WorkerInfo> selectWorkers(int count, LoadBalancingStrategy strategy) {
        List<CommonProto.WorkerInfo> availableWorkers = getAvailableWorkers();
        
        if (availableWorkers.isEmpty()) {
            return Collections.emptyList();
        }
        
        // Limit count to available workers
        count = Math.min(count, availableWorkers.size());
        
        List<CommonProto.WorkerInfo> selectedWorkers = new ArrayList<>();
        
        switch (strategy) {
            case ROUND_ROBIN -> {
                for (int i = 0; i < count; i++) {
                    CommonProto.WorkerInfo worker = selectRoundRobin(availableWorkers);
                    if (worker != null && !selectedWorkers.contains(worker)) {
                        selectedWorkers.add(worker);
                    }
                }
            }
            case LEAST_LOADED -> {
                // Sort by load and take the least loaded workers
                selectedWorkers = availableWorkers.stream()
                        .sorted(Comparator.comparingDouble(this::getWorkerLoadScore))
                        .limit(count)
                        .collect(Collectors.toList());
            }
            case LEAST_CONNECTIONS -> {
                // Sort by active connections and take workers with fewest connections
                selectedWorkers = availableWorkers.stream()
                        .sorted(Comparator.comparingInt(w -> w.getResources().getActiveQueries()))
                        .limit(count)
                        .collect(Collectors.toList());
            }
            case RESOURCE_AWARE -> {
                // Select workers with best resource availability
                selectedWorkers = availableWorkers.stream()
                        .sorted(Comparator.comparingDouble(this::getResourceAvailabilityScore).reversed())
                        .limit(count)
                        .collect(Collectors.toList());
            }
            default -> {
                // Default to round robin for other strategies
                for (int i = 0; i < count; i++) {
                    CommonProto.WorkerInfo worker = selectRoundRobin(availableWorkers);
                    if (worker != null && !selectedWorkers.contains(worker)) {
                        selectedWorkers.add(worker);
                    }
                }
            }
        }
        
        // Update load metrics for selected workers
        for (CommonProto.WorkerInfo worker : selectedWorkers) {
            updateWorkerLoad(worker.getWorkerId(), 1);
        }
        
        logger.debug("Selected {} workers using {} strategy: {}", 
                    selectedWorkers.size(), strategy, 
                    selectedWorkers.stream().map(CommonProto.WorkerInfo::getWorkerId).collect(Collectors.toList()));
        
        return selectedWorkers;
    }
    
    /**
     * Release load from a worker when a task completes
     */
    public void releaseWorkerLoad(String workerId, int loadAmount) {
        updateWorkerLoad(workerId, -loadAmount);
        logger.debug("Released load {} from worker {}", loadAmount, workerId);
    }
    
    /**
     * Get load balancing statistics
     */
    public LoadBalancingStats getLoadBalancingStats() {
        List<CommonProto.WorkerInfo> allWorkers = workerRegistryService.getWorkers(null);
        List<CommonProto.WorkerInfo> healthyWorkers = workerRegistryService.getHealthyWorkers();
        
        Map<String, Integer> workerLoads = new HashMap<>();
        int totalLoad = 0;
        
        for (CommonProto.WorkerInfo worker : allWorkers) {
            WorkerLoadMetrics metrics = workerLoadMetrics.get(worker.getWorkerId());
            int load = metrics != null ? metrics.getCurrentLoad() : 0;
            workerLoads.put(worker.getWorkerId(), load);
            totalLoad += load;
        }
        
        double avgLoad = healthyWorkers.isEmpty() ? 0.0 : (double) totalLoad / healthyWorkers.size();
        
        return new LoadBalancingStats(
                allWorkers.size(),
                healthyWorkers.size(),
                totalLoad,
                avgLoad,
                workerLoads
        );
    }
    
    /**
     * Reset load metrics for all workers
     */
    public void resetLoadMetrics() {
        workerLoadMetrics.clear();
        logger.info("Reset load balancing metrics");
    }
    
    private List<CommonProto.WorkerInfo> getAvailableWorkers() {
        List<CommonProto.WorkerInfo> healthyWorkers = workerRegistryService.getHealthyWorkers();
        
        // Filter out workers that are not ready (e.g., still starting up)
        return healthyWorkers.stream()
                .filter(this::isWorkerReady)
                .collect(Collectors.toList());
    }
    
    private boolean isWorkerReady(CommonProto.WorkerInfo worker) {
        // Check if worker container is running
        Optional<WorkerContainer> container = dockerService.getWorkerContainer(worker.getWorkerId());
        if (container.isPresent()) {
            return container.get().getStatus().isHealthy();
        }
        
        // If not managed by Docker (external worker), assume ready if healthy
        return true;
    }
    
    private CommonProto.WorkerInfo selectRoundRobin(List<CommonProto.WorkerInfo> workers) {
        if (workers.isEmpty()) return null;
        
        int index = roundRobinCounter.getAndIncrement() % workers.size();
        return workers.get(index);
    }
    
    private CommonProto.WorkerInfo selectLeastLoaded(List<CommonProto.WorkerInfo> workers) {
        return workers.stream()
                .min(Comparator.comparingDouble(this::getWorkerLoadScore))
                .orElse(null);
    }
    
    private CommonProto.WorkerInfo selectLeastConnections(List<CommonProto.WorkerInfo> workers) {
        return workers.stream()
                .min(Comparator.comparingInt(w -> w.getResources().getActiveQueries()))
                .orElse(null);
    }
    
    private CommonProto.WorkerInfo selectWeightedRoundRobin(List<CommonProto.WorkerInfo> workers) {
        // For now, use simple round robin. In production, this would consider worker weights
        // based on CPU, memory, or other capacity metrics
        return selectRoundRobin(workers);
    }
    
    private CommonProto.WorkerInfo selectResourceAware(List<CommonProto.WorkerInfo> workers) {
        return workers.stream()
                .max(Comparator.comparingDouble(this::getResourceAvailabilityScore))
                .orElse(null);
    }
    
    private double getWorkerLoadScore(CommonProto.WorkerInfo worker) {
        WorkerLoadMetrics metrics = workerLoadMetrics.get(worker.getWorkerId());
        int currentLoad = metrics != null ? metrics.getCurrentLoad() : 0;
        
        // Combine current load with resource usage
        double cpuUsage = worker.getResources().getCpuUtilization() * 100.0;
        double memoryUsage = worker.getResources().getMemoryUtilization() * 100.0;
        int activeQueries = worker.getResources().getActiveQueries();
        
        // Higher score means more loaded (worse for selection)
        return currentLoad * 0.4 + cpuUsage * 0.3 + memoryUsage * 0.2 + activeQueries * 0.1;
    }
    
    private double getResourceAvailabilityScore(CommonProto.WorkerInfo worker) {
        double cpuAvailable = 100.0 - (worker.getResources().getCpuUtilization() * 100.0);
        double memoryAvailable = 100.0 - (worker.getResources().getMemoryUtilization() * 100.0);
        
        // Higher score means more available resources (better for selection)
        return cpuAvailable * 0.6 + memoryAvailable * 0.4;
    }
    
    private void updateWorkerLoad(String workerId, int loadDelta) {
        workerLoadMetrics.compute(workerId, (id, metrics) -> {
            if (metrics == null) {
                metrics = new WorkerLoadMetrics(workerId);
            }
            metrics.updateLoad(loadDelta);
            return metrics;
        });
    }
    
    /**
     * Load balancing strategies
     */
    public enum LoadBalancingStrategy {
        ROUND_ROBIN("Distribute requests evenly across workers"),
        LEAST_LOADED("Send requests to worker with lowest load"),
        LEAST_CONNECTIONS("Send requests to worker with fewest active connections"),
        WEIGHTED_ROUND_ROBIN("Distribute based on worker capacity weights"),
        RESOURCE_AWARE("Select worker based on available CPU and memory");
        
        private final String description;
        
        LoadBalancingStrategy(String description) {
            this.description = description;
        }
        
        public String getDescription() { return description; }
    }
    
    /**
     * Tracks load metrics for a worker
     */
    private static class WorkerLoadMetrics {
        private final String workerId;
        private int currentLoad;
        private long lastUpdated;
        
        public WorkerLoadMetrics(String workerId) {
            this.workerId = workerId;
            this.currentLoad = 0;
            this.lastUpdated = System.currentTimeMillis();
        }
        
        public void updateLoad(int delta) {
            this.currentLoad = Math.max(0, this.currentLoad + delta);
            this.lastUpdated = System.currentTimeMillis();
        }
        
        public int getCurrentLoad() { return currentLoad; }
        public long getLastUpdated() { return lastUpdated; }
    }
    
    /**
     * Load balancing statistics
     */
    public static class LoadBalancingStats {
        private final int totalWorkers;
        private final int healthyWorkers;
        private final int totalLoad;
        private final double averageLoad;
        private final Map<String, Integer> workerLoads;
        
        public LoadBalancingStats(int totalWorkers, int healthyWorkers, int totalLoad, 
                                double averageLoad, Map<String, Integer> workerLoads) {
            this.totalWorkers = totalWorkers;
            this.healthyWorkers = healthyWorkers;
            this.totalLoad = totalLoad;
            this.averageLoad = averageLoad;
            this.workerLoads = new HashMap<>(workerLoads);
        }
        
        public int getTotalWorkers() { return totalWorkers; }
        public int getHealthyWorkers() { return healthyWorkers; }
        public int getTotalLoad() { return totalLoad; }
        public double getAverageLoad() { return averageLoad; }
        public Map<String, Integer> getWorkerLoads() { return new HashMap<>(workerLoads); }
        
        @Override
        public String toString() {
            return String.format("LoadBalancingStats{workers=%d/%d, totalLoad=%d, avgLoad=%.2f}", 
                               healthyWorkers, totalWorkers, totalLoad, averageLoad);
        }
    }
}