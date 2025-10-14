package com.minicloud.controlplane.planner;

import com.minicloud.controlplane.service.WorkerRegistryService;
import com.minicloud.controlplane.grpc.WorkerClient;
import com.minicloud.controlplane.orchestration.LoadBalancingService;
import com.minicloud.proto.execution.QueryExecutionProto.*;
import com.minicloud.proto.common.CommonProto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

/**
 * Schedules and coordinates distributed query execution across multiple workers.
 * Manages stage assignment, execution monitoring, and result collection.
 */
@Component
public class QueryScheduler {
    
    private static final Logger logger = LoggerFactory.getLogger(QueryScheduler.class);
    
    @Autowired
    private WorkerRegistryService workerRegistryService;
    
    @Autowired
    private WorkerClient workerClient;
    
    @Autowired
    private ResultAggregator resultAggregator;
    
    @Autowired
    private LoadBalancingService loadBalancingService;
    
    private final ExecutorService executorService = Executors.newCachedThreadPool();
    private final Map<String, QueryExecution> activeExecutions = new ConcurrentHashMap<>();
    
    /**
     * Execute a distributed query plan
     */
    public CompletableFuture<QueryExecutionResult> executeQuery(ExecutionPlan plan) {
        String queryId = plan.getQueryId();
        logger.info("Starting distributed execution for query: {}", queryId);
        
        QueryExecution execution = new QueryExecution(plan);
        activeExecutions.put(queryId, execution);
        
        return CompletableFuture.supplyAsync(() -> {
            try {
                return executeQueryInternal(execution);
            } catch (Exception e) {
                logger.error("Query execution failed for {}", queryId, e);
                return new QueryExecutionResult(queryId, false, e.getMessage(), null, 0);
            } finally {
                activeExecutions.remove(queryId);
            }
        }, executorService);
    }
    
    /**
     * Cancel a running query
     */
    public boolean cancelQuery(String queryId, String reason) {
        logger.info("Cancelling query: {} - reason: {}", queryId, reason);
        
        QueryExecution execution = activeExecutions.get(queryId);
        if (execution != null) {
            execution.cancel(reason);
            
            // Send cancellation requests to all workers
            for (WorkerAssignment assignment : execution.getWorkerAssignments()) {
                try {
                    workerClient.cancelQuery(assignment.getWorkerId(), queryId, reason);
                } catch (Exception e) {
                    logger.warn("Failed to cancel query {} on worker {}", queryId, assignment.getWorkerId(), e);
                }
            }
            
            return true;
        }
        
        return false;
    }
    
    /**
     * Get status of a running query
     */
    public Optional<QueryExecutionStatus> getQueryStatus(String queryId) {
        QueryExecution execution = activeExecutions.get(queryId);
        return execution != null ? Optional.of(execution.getStatus()) : Optional.empty();
    }
    
    /**
     * Get all active query executions
     */
    public List<QueryExecutionStatus> getActiveQueries() {
        return activeExecutions.values().stream()
                .map(QueryExecution::getStatus)
                .collect(Collectors.toList());
    }
    
    private QueryExecutionResult executeQueryInternal(QueryExecution execution) {
        ExecutionPlan plan = execution.getPlan();
        String queryId = plan.getQueryId();
        
        try {
            logger.info("Executing plan with {} stages for query {}", plan.getStageCount(), queryId);
            
            // Get available workers
            List<CommonProto.WorkerInfo> availableWorkers = workerRegistryService.getHealthyWorkers();
            if (availableWorkers.isEmpty()) {
                throw new RuntimeException("No healthy workers available for query execution");
            }
            
            logger.info("Found {} healthy workers for query execution", availableWorkers.size());
            
            // Execute stages in topological order
            Set<Integer> completedStages = new HashSet<>();
            List<StageExecutionResult> stageResults = new ArrayList<>();
            
            while (!plan.isComplete(completedStages) && !execution.isCancelled()) {
                // Get stages that are ready to execute
                List<ExecutionStage> readyStages = plan.getReadyStages(completedStages);
                
                if (readyStages.isEmpty()) {
                    throw new RuntimeException("No ready stages found - possible circular dependency");
                }
                
                logger.info("Executing {} ready stages for query {}", readyStages.size(), queryId);
                
                // Execute ready stages in parallel
                List<CompletableFuture<StageExecutionResult>> stageFutures = new ArrayList<>();
                
                for (ExecutionStage stage : readyStages) {
                    // Assign stage to a worker
                    WorkerAssignment assignment = assignStageToWorker(stage, availableWorkers);
                    execution.addWorkerAssignment(assignment);
                    
                    // Execute stage asynchronously
                    CompletableFuture<StageExecutionResult> stageFuture = executeStageAsync(assignment, stage);
                    stageFutures.add(stageFuture);
                }
                
                // Wait for all stages to complete
                CompletableFuture<Void> allStages = CompletableFuture.allOf(
                        stageFutures.toArray(new CompletableFuture[0]));
                
                try {
                    allStages.get(30, TimeUnit.SECONDS); // 30 second timeout per batch
                } catch (TimeoutException e) {
                    logger.error("Stage execution timeout for query {}", queryId);
                    throw new RuntimeException("Stage execution timeout", e);
                }
                
                // Collect results
                for (CompletableFuture<StageExecutionResult> future : stageFutures) {
                    StageExecutionResult result = future.get();
                    stageResults.add(result);
                    
                    if (result.isSuccess()) {
                        completedStages.add(result.getStageId());
                        logger.debug("Stage {} completed successfully for query {}", result.getStageId(), queryId);
                    } else {
                        throw new RuntimeException("Stage " + result.getStageId() + " failed: " + result.getErrorMessage());
                    }
                }
            }
            
            if (execution.isCancelled()) {
                logger.info("Query {} was cancelled during execution", queryId);
                return new QueryExecutionResult(queryId, false, "Query cancelled", null, 0);
            }
            
            // Aggregate results from all stages
            logger.info("Aggregating results from {} stages for query {}", stageResults.size(), queryId);
            QueryResult aggregatedResult = resultAggregator.aggregateResults(queryId, stageResults);
            
            long totalRows = aggregatedResult != null ? aggregatedResult.getTotalRows() : 0;
            logger.info("Query {} completed successfully with {} rows", queryId, totalRows);
            
            return new QueryExecutionResult(queryId, true, null, aggregatedResult, totalRows);
            
        } catch (Exception e) {
            logger.error("Query execution failed for {}", queryId, e);
            return new QueryExecutionResult(queryId, false, e.getMessage(), null, 0);
        }
    }
    
    /**
     * Assign a stage to the best available worker using load balancing
     */
    private WorkerAssignment assignStageToWorker(ExecutionStage stage, List<CommonProto.WorkerInfo> availableWorkers) {
        if (availableWorkers.isEmpty()) {
            throw new RuntimeException("No workers available for stage assignment");
        }
        
        // Use load balancing service to select optimal worker
        Optional<CommonProto.WorkerInfo> selectedWorkerOpt = loadBalancingService.selectWorker(
                LoadBalancingService.LoadBalancingStrategy.RESOURCE_AWARE
        );
        
        CommonProto.WorkerInfo selectedWorker = selectedWorkerOpt.orElse(
                availableWorkers.stream()
                        .min(Comparator.comparingInt(w -> w.getResources().getActiveQueries()))
                        .orElse(availableWorkers.get(0))
        );
        
        logger.debug("Assigned stage {} to worker {} using load balancing", stage.getStageId(), selectedWorker.getWorkerId());
        
        return new WorkerAssignment(selectedWorker.getWorkerId(), selectedWorker.getEndpoint(), stage);
    }
    
    /**
     * Execute a stage asynchronously on a worker
     */
    private CompletableFuture<StageExecutionResult> executeStageAsync(WorkerAssignment assignment, ExecutionStage stage) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                logger.debug("Executing stage {} on worker {}", stage.getStageId(), assignment.getWorkerId());
                
                ExecuteStageRequest request = ExecuteStageRequest.newBuilder()
                        .setQueryId(assignment.getStage().toString()) // Using stage as query context
                        .setStageId(stage.getStageId())
                        .setStage(stage)
                        .setTraceId(UUID.randomUUID().toString())
                        .build();
                
                ExecuteStageResponse response = workerClient.executeStage(assignment.getWorkerId(), request);
                
                if (response.getStatus() == ExecutionStatus.COMPLETED) {
                    logger.debug("Stage {} completed on worker {}", stage.getStageId(), assignment.getWorkerId());
                    return new StageExecutionResult(stage.getStageId(), true, null, response.getResultLocation(), response.getStats());
                } else {
                    logger.error("Stage {} failed on worker {}: {}", stage.getStageId(), assignment.getWorkerId(), response.getErrorMessage());
                    return new StageExecutionResult(stage.getStageId(), false, response.getErrorMessage(), null, null);
                }
                
            } catch (Exception e) {
                logger.error("Error executing stage {} on worker {}", stage.getStageId(), assignment.getWorkerId(), e);
                return new StageExecutionResult(stage.getStageId(), false, e.getMessage(), null, null);
            }
        }, executorService);
    }
    
    /**
     * Represents an assignment of a stage to a worker
     */
    public static class WorkerAssignment {
        private final String workerId;
        private final String workerEndpoint;
        private final ExecutionStage stage;
        
        public WorkerAssignment(String workerId, String workerEndpoint, ExecutionStage stage) {
            this.workerId = workerId;
            this.workerEndpoint = workerEndpoint;
            this.stage = stage;
        }
        
        public String getWorkerId() { return workerId; }
        public String getWorkerEndpoint() { return workerEndpoint; }
        public ExecutionStage getStage() { return stage; }
    }
    
    /**
     * Tracks the execution state of a distributed query
     */
    private static class QueryExecution {
        private final ExecutionPlan plan;
        private final List<WorkerAssignment> workerAssignments = new ArrayList<>();
        private volatile boolean cancelled = false;
        private volatile String cancellationReason;
        private final long startTime = System.currentTimeMillis();
        
        public QueryExecution(ExecutionPlan plan) {
            this.plan = plan;
        }
        
        public ExecutionPlan getPlan() { return plan; }
        public List<WorkerAssignment> getWorkerAssignments() { return new ArrayList<>(workerAssignments); }
        public boolean isCancelled() { return cancelled; }
        
        public void addWorkerAssignment(WorkerAssignment assignment) {
            workerAssignments.add(assignment);
        }
        
        public void cancel(String reason) {
            this.cancelled = true;
            this.cancellationReason = reason;
        }
        
        public QueryExecutionStatus getStatus() {
            return new QueryExecutionStatus(
                    plan.getQueryId(),
                    cancelled ? "CANCELLED" : "RUNNING",
                    workerAssignments.size(),
                    System.currentTimeMillis() - startTime,
                    cancellationReason
            );
        }
    }
    
    /**
     * Status information for a query execution
     */
    public static class QueryExecutionStatus {
        private final String queryId;
        private final String status;
        private final int assignedWorkers;
        private final long executionTimeMs;
        private final String errorMessage;
        
        public QueryExecutionStatus(String queryId, String status, int assignedWorkers, 
                                  long executionTimeMs, String errorMessage) {
            this.queryId = queryId;
            this.status = status;
            this.assignedWorkers = assignedWorkers;
            this.executionTimeMs = executionTimeMs;
            this.errorMessage = errorMessage;
        }
        
        public String getQueryId() { return queryId; }
        public String getStatus() { return status; }
        public int getAssignedWorkers() { return assignedWorkers; }
        public long getExecutionTimeMs() { return executionTimeMs; }
        public String getErrorMessage() { return errorMessage; }
    }
    
    /**
     * Result of executing a single stage
     */
    public static class StageExecutionResult {
        private final int stageId;
        private final boolean success;
        private final String errorMessage;
        private final String resultLocation;
        private final CommonProto.ExecutionStats stats;
        
        public StageExecutionResult(int stageId, boolean success, String errorMessage, 
                                  String resultLocation, CommonProto.ExecutionStats stats) {
            this.stageId = stageId;
            this.success = success;
            this.errorMessage = errorMessage;
            this.resultLocation = resultLocation;
            this.stats = stats;
        }
        
        public int getStageId() { return stageId; }
        public boolean isSuccess() { return success; }
        public String getErrorMessage() { return errorMessage; }
        public String getResultLocation() { return resultLocation; }
        public CommonProto.ExecutionStats getStats() { return stats; }
    }
    
    /**
     * Final result of a distributed query execution
     */
    public static class QueryExecutionResult {
        private final String queryId;
        private final boolean success;
        private final String errorMessage;
        private final QueryResult result;
        private final long totalRows;
        
        public QueryExecutionResult(String queryId, boolean success, String errorMessage, 
                                  QueryResult result, long totalRows) {
            this.queryId = queryId;
            this.success = success;
            this.errorMessage = errorMessage;
            this.result = result;
            this.totalRows = totalRows;
        }
        
        public String getQueryId() { return queryId; }
        public boolean isSuccess() { return success; }
        public String getErrorMessage() { return errorMessage; }
        public QueryResult getResult() { return result; }
        public long getTotalRows() { return totalRows; }
    }
    
    /**
     * Aggregated query result
     */
    public static class QueryResult {
        private final List<String> columns;
        private final List<List<Object>> rows;
        private final long totalRows;
        
        public QueryResult(List<String> columns, List<List<Object>> rows) {
            this.columns = new ArrayList<>(columns);
            this.rows = new ArrayList<>(rows);
            this.totalRows = rows.size();
        }
        
        public List<String> getColumns() { return new ArrayList<>(columns); }
        public List<List<Object>> getRows() { return new ArrayList<>(rows); }
        public long getTotalRows() { return totalRows; }
    }
}