package com.minicloud.worker.grpc;

import com.minicloud.worker.service.WorkerRegistrationService;
import com.minicloud.proto.execution.QueryExecutionServiceGrpc;
import com.minicloud.proto.execution.QueryExecutionProto.*;
import com.minicloud.proto.common.CommonProto;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * gRPC implementation of QueryExecutionService for distributed query execution.
 * This service handles query stage execution, progress reporting, and health monitoring.
 */
@GrpcService
public class QueryExecutionServiceImpl extends QueryExecutionServiceGrpc.QueryExecutionServiceImplBase {
    
    private static final Logger logger = LoggerFactory.getLogger(QueryExecutionServiceImpl.class);
    
    @Autowired
    private WorkerRegistrationService workerRegistrationService;
    
    private final ConcurrentHashMap<String, QueryExecution> activeQueries = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4);
    
    @Override
    public void executeStage(ExecuteStageRequest request, StreamObserver<ExecuteStageResponse> responseObserver) {
        String queryId = request.getQueryId();
        int stageId = request.getStageId();
        
        logger.info("Executing stage {} for query {}", stageId, queryId);
        
        try {
            // Create query execution tracking
            QueryExecution execution = new QueryExecution(queryId, stageId);
            activeQueries.put(queryId, execution);
            
            // Update active query count for health monitoring
            workerRegistrationService.incrementActiveQueries();
            
            // Execute stage asynchronously
            CompletableFuture.supplyAsync(() -> {
                try {
                    return executeStageInternal(request);
                } catch (Exception e) {
                    logger.error("Error executing stage {} for query {}", stageId, queryId, e);
                    throw new RuntimeException(e);
                }
            }).thenAccept(response -> {
                responseObserver.onNext(response);
                responseObserver.onCompleted();
                activeQueries.remove(queryId);
                workerRegistrationService.decrementActiveQueries();
            }).exceptionally(throwable -> {
                logger.error("Stage execution failed for query {}, stage {}", queryId, stageId, throwable);
                ExecuteStageResponse errorResponse = ExecuteStageResponse.newBuilder()
                        .setQueryId(queryId)
                        .setStageId(stageId)
                        .setStatus(ExecutionStatus.FAILED)
                        .setErrorMessage(throwable.getMessage())
                        .setTraceId(request.getTraceId())
                        .build();
                responseObserver.onNext(errorResponse);
                responseObserver.onCompleted();
                activeQueries.remove(queryId);
                workerRegistrationService.decrementActiveQueries();
                return null;
            });
            
        } catch (Exception e) {
            logger.error("Error starting stage execution for query {}, stage {}", queryId, stageId, e);
            responseObserver.onError(e);
        }
    }

    @Override
    public void streamProgress(ExecuteStageRequest request, StreamObserver<ProgressUpdate> responseObserver) {
        String queryId = request.getQueryId();
        int stageId = request.getStageId();
        
        logger.info("Starting progress stream for query {}, stage {}", queryId, stageId);
        
        // Schedule periodic progress updates
        scheduler.scheduleAtFixedRate(() -> {
            try {
                QueryExecution execution = activeQueries.get(queryId);
                if (execution != null) {
                    ProgressUpdate update = ProgressUpdate.newBuilder()
                            .setQueryId(queryId)
                            .setStageId(stageId)
                            .setStatus(execution.getStatus())
                            .setProgressPercentage(execution.getProgressPercentage())
                            .setCurrentStats(execution.getStats())
                            .build();
                    
                    responseObserver.onNext(update);
                } else {
                    // Query completed or cancelled
                    responseObserver.onCompleted();
                }
            } catch (Exception e) {
                logger.error("Error sending progress update for query {}", queryId, e);
                responseObserver.onError(e);
            }
        }, 0, 1, TimeUnit.SECONDS);
    }

    @Override
    public void reportHealth(HealthRequest request, StreamObserver<HealthResponse> responseObserver) {
        logger.debug("Health check requested by worker {}", request.getWorkerId());
        
        try {
            // Create worker info with current resource usage
            CommonProto.ResourceInfo resourceInfo = CommonProto.ResourceInfo.newBuilder()
                    .setCpuCores(Runtime.getRuntime().availableProcessors())
                    .setMemoryMb(Runtime.getRuntime().maxMemory() / (1024 * 1024))
                    .setActiveQueries(activeQueries.size())
                    .setCpuUtilization(0.5) // TODO: Get actual CPU utilization
                    .setMemoryUtilization(0.3) // TODO: Get actual memory utilization
                    .build();
            
            CommonProto.WorkerInfo workerInfo = CommonProto.WorkerInfo.newBuilder()
                    .setWorkerId(request.getWorkerId())
                    .setEndpoint("localhost:9090") // TODO: Get actual endpoint
                    .setStatus(CommonProto.WorkerStatus.HEALTHY)
                    .setResources(resourceInfo)
                    .build();
            
            HealthResponse response = HealthResponse.newBuilder()
                    .setWorkerInfo(workerInfo)
                    .setResponse(createSuccessResponse())
                    .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
            
        } catch (Exception e) {
            logger.error("Error reporting health for worker {}", request.getWorkerId(), e);
            responseObserver.onError(e);
        }
    }

    @Override
    public void cancelQuery(CancelQueryRequest request, StreamObserver<CancelQueryResponse> responseObserver) {
        String queryId = request.getQueryId();
        logger.info("Cancelling query {}, reason: {}", queryId, request.getReason());
        
        try {
            QueryExecution execution = activeQueries.get(queryId);
            boolean cancelled = false;
            
            if (execution != null) {
                execution.cancel();
                activeQueries.remove(queryId);
                workerRegistrationService.decrementActiveQueries();
                cancelled = true;
            }
            
            CancelQueryResponse response = CancelQueryResponse.newBuilder()
                    .setQueryId(queryId)
                    .setCancelled(cancelled)
                    .setResponse(createSuccessResponse())
                    .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
            
        } catch (Exception e) {
            logger.error("Error cancelling query {}", queryId, e);
            responseObserver.onError(e);
        }
    }

    private ExecuteStageResponse executeStageInternal(ExecuteStageRequest request) {
        String queryId = request.getQueryId();
        int stageId = request.getStageId();
        ExecutionStage stage = request.getStage();
        
        logger.info("Executing stage type: {} for query {}", stage.getType(), queryId);
        
        // TODO: Implement actual query execution with Arrow
        // For now, simulate execution with a delay
        try {
            Thread.sleep(1000); // Simulate processing time
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Stage execution interrupted", e);
        }
        
        // Create mock execution stats
        CommonProto.ExecutionStats stats = CommonProto.ExecutionStats.newBuilder()
                .setRowsProcessed(1000)
                .setBytesProcessed(50000)
                .setExecutionTimeMs(1000)
                .setCpuTimeMs(800)
                .setMemoryPeakMb(100)
                .build();
        
        return ExecuteStageResponse.newBuilder()
                .setQueryId(queryId)
                .setStageId(stageId)
                .setStatus(ExecutionStatus.COMPLETED)
                .setResultLocation("flight://localhost:8815/results/" + queryId + "/" + stageId)
                .setStats(stats)
                .setTraceId(request.getTraceId())
                .build();
    }

    private CommonProto.StandardResponse createSuccessResponse() {
        return CommonProto.StandardResponse.newBuilder()
                .setStatus(CommonProto.ResponseStatus.SUCCESS)
                .setRequestId(UUID.randomUUID().toString())
                .build();
    }
    
    /**
     * Internal class to track query execution state
     */
    private static class QueryExecution {
        private final String queryId;
        private final int stageId;
        private volatile ExecutionStatus status = ExecutionStatus.RUNNING;
        private volatile double progressPercentage = 0.0;
        private volatile boolean cancelled = false;
        
        public QueryExecution(String queryId, int stageId) {
            this.queryId = queryId;
            this.stageId = stageId;
        }
        
        public ExecutionStatus getStatus() {
            return cancelled ? ExecutionStatus.CANCELLED : status;
        }
        
        public double getProgressPercentage() {
            return progressPercentage;
        }
        
        public CommonProto.ExecutionStats getStats() {
            return CommonProto.ExecutionStats.newBuilder()
                    .setRowsProcessed((long) (progressPercentage * 1000))
                    .setBytesProcessed((long) (progressPercentage * 50000))
                    .setExecutionTimeMs(System.currentTimeMillis() % 10000)
                    .build();
        }
        
        public void cancel() {
            this.cancelled = true;
        }
    }
}