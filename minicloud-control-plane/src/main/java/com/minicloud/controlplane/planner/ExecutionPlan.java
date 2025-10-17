package com.minicloud.controlplane.planner;

import com.minicloud.proto.execution.QueryExecutionProto.ExecutionStage;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Represents a distributed execution plan for a query.
 * Contains multiple stages that can be executed in parallel across workers.
 */
public class ExecutionPlan {
    
    private final String queryId;
    private final String originalSql;
    private final List<ExecutionStage> stages;
    private final Map<Integer, Set<Integer>> stageDependencies;
    private final Instant createdAt;
    
    public ExecutionPlan(String queryId, String originalSql, List<ExecutionStage> stages) {
        this.queryId = queryId;
        this.originalSql = originalSql;
        this.stages = new ArrayList<>(stages);
        this.stageDependencies = new HashMap<>();
        this.createdAt = Instant.now();
        
        // Initialize empty dependencies for all stages
        for (ExecutionStage stage : stages) {
            stageDependencies.put(stage.getStageId(), new HashSet<>());
        }
    }
    
    /**
     * Get the query ID this plan belongs to
     */
    public String getQueryId() {
        return queryId;
    }
    
    /**
     * Get the original SQL query
     */
    public String getOriginalSql() {
        return originalSql;
    }
    
    /**
     * Get all execution stages
     */
    public List<ExecutionStage> getStages() {
        return new ArrayList<>(stages);
    }
    
    /**
     * Get a specific stage by ID
     */
    public Optional<ExecutionStage> getStage(int stageId) {
        return stages.stream()
                .filter(stage -> stage.getStageId() == stageId)
                .findFirst();
    }
    
    /**
     * Get the number of stages in this plan
     */
    public int getStageCount() {
        return stages.size();
    }
    
    /**
     * Get when this plan was created
     */
    public Instant getCreatedAt() {
        return createdAt;
    }
    
    /**
     * Add a dependency between stages (dependentStage depends on prerequisiteStage)
     */
    public void addStageDependency(int dependentStageId, int prerequisiteStageId) {
        stageDependencies.computeIfAbsent(dependentStageId, k -> new HashSet<>())
                .add(prerequisiteStageId);
    }
    
    /**
     * Get all stages that a given stage depends on
     */
    public Set<Integer> getStageDependencies(int stageId) {
        return new HashSet<>(stageDependencies.getOrDefault(stageId, Set.of()));
    }
    
    /**
     * Get all stages that have no dependencies (can be executed first)
     */
    public List<ExecutionStage> getRootStages() {
        return stages.stream()
                .filter(stage -> stageDependencies.get(stage.getStageId()).isEmpty())
                .collect(Collectors.toList());
    }
    
    /**
     * Get all stages that can be executed after the given completed stages
     */
    public List<ExecutionStage> getReadyStages(Set<Integer> completedStageIds) {
        return stages.stream()
                .filter(stage -> {
                    Set<Integer> dependencies = stageDependencies.get(stage.getStageId());
                    return !completedStageIds.contains(stage.getStageId()) && 
                           completedStageIds.containsAll(dependencies);
                })
                .collect(Collectors.toList());
    }
    
    /**
     * Check if all stages in the plan have been completed
     */
    public boolean isComplete(Set<Integer> completedStageIds) {
        return completedStageIds.size() == stages.size() &&
               stages.stream().allMatch(stage -> completedStageIds.contains(stage.getStageId()));
    }
    
    /**
     * Get stages in topological order (respecting dependencies)
     */
    public List<ExecutionStage> getStagesInTopologicalOrder() {
        List<ExecutionStage> result = new ArrayList<>();
        Set<Integer> visited = new HashSet<>();
        Set<Integer> visiting = new HashSet<>();
        
        for (ExecutionStage stage : stages) {
            if (!visited.contains(stage.getStageId())) {
                topologicalSort(stage.getStageId(), visited, visiting, result);
            }
        }
        
        return result;
    }
    
    /**
     * Get execution plan statistics
     */
    public ExecutionPlanStats getStats() {
        Map<String, Long> stageTypeCounts = stages.stream()
                .collect(Collectors.groupingBy(
                        stage -> stage.getType().name(),
                        Collectors.counting()
                ));
        
        long totalPartitions = stages.stream()
                .mapToLong(stage -> stage.getInputPartitionsCount())
                .sum();
        
        return new ExecutionPlanStats(
                stages.size(),
                stageTypeCounts,
                totalPartitions,
                getMaxParallelism()
        );
    }
    
    /**
     * Get the maximum parallelism of this plan (max stages that can run concurrently)
     */
    public int getMaxParallelism() {
        // Calculate the maximum number of stages that can run in parallel
        // This is a simplified calculation - in reality it would be more complex
        Set<Integer> processed = new HashSet<>();
        int maxParallel = 0;
        
        while (processed.size() < stages.size()) {
            List<ExecutionStage> ready = getReadyStages(processed);
            maxParallel = Math.max(maxParallel, ready.size());
            
            // Mark all ready stages as processed for next iteration
            ready.forEach(stage -> processed.add(stage.getStageId()));
        }
        
        return maxParallel;
    }
    
    /**
     * Create a summary of this execution plan
     */
    public String getSummary() {
        ExecutionPlanStats stats = getStats();
        return String.format("ExecutionPlan{queryId=%s, stages=%d, maxParallelism=%d, partitions=%d}",
                queryId, stats.getTotalStages(), stats.getMaxParallelism(), stats.getTotalPartitions());
    }
    
    private void topologicalSort(int stageId, Set<Integer> visited, Set<Integer> visiting, List<ExecutionStage> result) {
        if (visiting.contains(stageId)) {
            throw new IllegalStateException("Circular dependency detected in execution plan");
        }
        
        if (visited.contains(stageId)) {
            return;
        }
        
        visiting.add(stageId);
        
        // Visit all dependencies first
        for (int dependency : stageDependencies.get(stageId)) {
            topologicalSort(dependency, visited, visiting, result);
        }
        
        visiting.remove(stageId);
        visited.add(stageId);
        
        // Add this stage to result
        getStage(stageId).ifPresent(result::add);
    }
    
    @Override
    public String toString() {
        return "ExecutionPlan{" +
                "queryId='" + queryId + '\'' +
                ", stages=" + stages.size() +
                ", createdAt=" + createdAt +
                '}';
    }
    
    /**
     * Statistics about an execution plan
     */
    public static class ExecutionPlanStats {
        private final int totalStages;
        private final Map<String, Long> stageTypeCounts;
        private final long totalPartitions;
        private final int maxParallelism;
        
        public ExecutionPlanStats(int totalStages, Map<String, Long> stageTypeCounts, 
                                long totalPartitions, int maxParallelism) {
            this.totalStages = totalStages;
            this.stageTypeCounts = new HashMap<>(stageTypeCounts);
            this.totalPartitions = totalPartitions;
            this.maxParallelism = maxParallelism;
        }
        
        public int getTotalStages() { return totalStages; }
        public Map<String, Long> getStageTypeCounts() { return new HashMap<>(stageTypeCounts); }
        public long getTotalPartitions() { return totalPartitions; }
        public int getMaxParallelism() { return maxParallelism; }
        
        @Override
        public String toString() {
            return "ExecutionPlanStats{" +
                    "totalStages=" + totalStages +
                    ", stageTypeCounts=" + stageTypeCounts +
                    ", totalPartitions=" + totalPartitions +
                    ", maxParallelism=" + maxParallelism +
                    '}';
        }
    }
}