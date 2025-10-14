package com.minicloud.controlplane.grpc;

import com.minicloud.controlplane.service.WorkerRegistryService;
import com.minicloud.proto.execution.QueryExecutionServiceGrpc;
import com.minicloud.proto.execution.QueryExecutionProto.*;
import com.minicloud.proto.common.CommonProto;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.StatusRuntimeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.annotation.PreDestroy;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * gRPC client for communicating with worker nodes.
 * Manages connections to workers and provides methods for query execution.
 */
@Component
public class WorkerClient {
    
    private static final Logger logger = LoggerFactory.getLogger(WorkerClient.class);
    
    @Autowired
    private WorkerRegistryService workerRegistryService;
    
    // Cache of gRPC channels to workers
    private final Map<String, ManagedChannel> workerChannels = new ConcurrentHashMap<>();
    private final Map<String, QueryExecutionServiceGrpc.QueryExecutionServiceBlockingStub> workerStubs = new ConcurrentHashMap<>();
    
    /**
     * Execute a stage on a specific worker
     */
    public ExecuteStageResponse executeStage(String workerId, ExecuteStageRequest request) {
        logger.debug("Executing stage {} on worker {}", request.getStageId(), workerId);
        
        try {
            QueryExecutionServiceGrpc.QueryExecutionServiceBlockingStub stub = getWorkerStub(workerId);
            
            if (stub == null) {
                throw new RuntimeException("Unable to connect to worker: " + workerId);
            }
            
            ExecuteStageResponse response = stub.withDeadlineAfter(30, TimeUnit.SECONDS)
                    .executeStage(request);
            
            logger.debug("Stage {} execution completed on worker {} with status: {}", 
                        request.getStageId(), workerId, response.getStatus());
            
            return response;
            
        } catch (StatusRuntimeException e) {
            logger.error("gRPC error executing stage {} on worker {}: {}", 
                        request.getStageId(), workerId, e.getStatus());
            throw new RuntimeException("Failed to execute stage on worker " + workerId, e);
        } catch (Exception e) {
            logger.error("Error executing stage {} on worker {}", request.getStageId(), workerId, e);
            throw new RuntimeException("Failed to execute stage on worker " + workerId, e);
        }
    }
    
    /**
     * Cancel a query on a specific worker
     */
    public CancelQueryResponse cancelQuery(String workerId, String queryId, String reason) {
        logger.info("Cancelling query {} on worker {} - reason: {}", queryId, workerId, reason);
        
        try {
            QueryExecutionServiceGrpc.QueryExecutionServiceBlockingStub stub = getWorkerStub(workerId);
            
            if (stub == null) {
                logger.warn("Unable to connect to worker {} for query cancellation", workerId);
                return CancelQueryResponse.newBuilder()
                        .setQueryId(queryId)
                        .setCancelled(false)
                        .setResponse(createErrorResponse("Unable to connect to worker"))
                        .build();
            }
            
            CancelQueryRequest request = CancelQueryRequest.newBuilder()
                    .setQueryId(queryId)
                    .setReason(reason)
                    .build();
            
            CancelQueryResponse response = stub.withDeadlineAfter(10, TimeUnit.SECONDS)
                    .cancelQuery(request);
            
            logger.info("Query {} cancellation on worker {} result: {}", 
                       queryId, workerId, response.getCancelled());
            
            return response;
            
        } catch (StatusRuntimeException e) {
            logger.error("gRPC error cancelling query {} on worker {}: {}", 
                        queryId, workerId, e.getStatus());
            return CancelQueryResponse.newBuilder()
                    .setQueryId(queryId)
                    .setCancelled(false)
                    .setResponse(createErrorResponse("gRPC error: " + e.getStatus()))
                    .build();
        } catch (Exception e) {
            logger.error("Error cancelling query {} on worker {}", queryId, workerId, e);
            return CancelQueryResponse.newBuilder()
                    .setQueryId(queryId)
                    .setCancelled(false)
                    .setResponse(createErrorResponse("Error: " + e.getMessage()))
                    .build();
        }
    }
    
    /**
     * Get health status from a worker
     */
    public HealthResponse getWorkerHealth(String workerId) {
        logger.debug("Getting health status from worker {}", workerId);
        
        try {
            QueryExecutionServiceGrpc.QueryExecutionServiceBlockingStub stub = getWorkerStub(workerId);
            
            if (stub == null) {
                throw new RuntimeException("Unable to connect to worker: " + workerId);
            }
            
            HealthRequest request = HealthRequest.newBuilder()
                    .setWorkerId(workerId)
                    .setTimestamp(com.google.protobuf.Timestamp.newBuilder()
                            .setSeconds(System.currentTimeMillis() / 1000)
                            .build())
                    .build();
            
            HealthResponse response = stub.withDeadlineAfter(5, TimeUnit.SECONDS)
                    .reportHealth(request);
            
            logger.debug("Health check completed for worker {}", workerId);
            return response;
            
        } catch (StatusRuntimeException e) {
            logger.error("gRPC error getting health from worker {}: {}", workerId, e.getStatus());
            throw new RuntimeException("Failed to get health from worker " + workerId, e);
        } catch (Exception e) {
            logger.error("Error getting health from worker {}", workerId, e);
            throw new RuntimeException("Failed to get health from worker " + workerId, e);
        }
    }
    
    /**
     * Test connectivity to a worker
     */
    public boolean testWorkerConnection(String workerId) {
        try {
            getWorkerHealth(workerId);
            return true;
        } catch (Exception e) {
            logger.debug("Worker {} connectivity test failed: {}", workerId, e.getMessage());
            return false;
        }
    }
    
    /**
     * Get or create a gRPC stub for a worker
     */
    private QueryExecutionServiceGrpc.QueryExecutionServiceBlockingStub getWorkerStub(String workerId) {
        return workerStubs.computeIfAbsent(workerId, this::createWorkerStub);
    }
    
    /**
     * Create a new gRPC stub for a worker
     */
    private QueryExecutionServiceGrpc.QueryExecutionServiceBlockingStub createWorkerStub(String workerId) {
        try {
            // Get worker info from registry
            CommonProto.WorkerInfo workerInfo = workerRegistryService.getWorker(workerId);
            
            if (workerInfo == null) {
                logger.error("Worker {} not found in registry", workerId);
                return null;
            }
            
            if (workerInfo.getStatus() != CommonProto.WorkerStatus.HEALTHY) {
                logger.warn("Worker {} is not healthy (status: {})", workerId, workerInfo.getStatus());
                return null;
            }
            
            // Create gRPC channel
            ManagedChannel channel = getOrCreateChannel(workerId, workerInfo.getEndpoint());
            
            if (channel == null) {
                return null;
            }
            
            // Create blocking stub
            QueryExecutionServiceGrpc.QueryExecutionServiceBlockingStub stub = 
                    QueryExecutionServiceGrpc.newBlockingStub(channel);
            
            logger.debug("Created gRPC stub for worker {} at endpoint {}", workerId, workerInfo.getEndpoint());
            return stub;
            
        } catch (Exception e) {
            logger.error("Failed to create gRPC stub for worker {}", workerId, e);
            return null;
        }
    }
    
    /**
     * Get or create a gRPC channel for a worker endpoint
     */
    private ManagedChannel getOrCreateChannel(String workerId, String endpoint) {
        return workerChannels.computeIfAbsent(workerId, id -> {
            try {
                logger.info("Creating gRPC channel to worker {} at endpoint {}", workerId, endpoint);
                
                // Parse endpoint (format: host:port)
                String[] parts = endpoint.split(":");
                if (parts.length != 2) {
                    logger.error("Invalid endpoint format for worker {}: {}", workerId, endpoint);
                    return null;
                }
                
                String host = parts[0];
                int port = Integer.parseInt(parts[1]);
                
                ManagedChannel channel = ManagedChannelBuilder.forAddress(host, port)
                        .usePlaintext() // TODO: Use TLS in production
                        .keepAliveTime(30, TimeUnit.SECONDS)
                        .keepAliveTimeout(5, TimeUnit.SECONDS)
                        .keepAliveWithoutCalls(true)
                        .maxInboundMessageSize(16 * 1024 * 1024) // 16MB max message size
                        .build();
                
                logger.info("Created gRPC channel for worker {} at {}:{}", workerId, host, port);
                return channel;
                
            } catch (Exception e) {
                logger.error("Failed to create gRPC channel for worker {} at endpoint {}", workerId, endpoint, e);
                return null;
            }
        });
    }
    
    /**
     * Close connection to a specific worker
     */
    public void closeWorkerConnection(String workerId) {
        logger.info("Closing connection to worker {}", workerId);
        
        // Remove stub
        workerStubs.remove(workerId);
        
        // Close channel
        ManagedChannel channel = workerChannels.remove(workerId);
        if (channel != null) {
            try {
                channel.shutdown();
                if (!channel.awaitTermination(5, TimeUnit.SECONDS)) {
                    logger.warn("Channel to worker {} did not terminate gracefully, forcing shutdown", workerId);
                    channel.shutdownNow();
                }
            } catch (InterruptedException e) {
                logger.warn("Interrupted while closing channel to worker {}", workerId);
                Thread.currentThread().interrupt();
            }
        }
    }
    
    /**
     * Close all worker connections
     */
    @PreDestroy
    public void closeAllConnections() {
        logger.info("Closing all worker connections");
        
        workerStubs.clear();
        
        for (Map.Entry<String, ManagedChannel> entry : workerChannels.entrySet()) {
            String workerId = entry.getKey();
            ManagedChannel channel = entry.getValue();
            
            try {
                channel.shutdown();
                if (!channel.awaitTermination(5, TimeUnit.SECONDS)) {
                    logger.warn("Channel to worker {} did not terminate gracefully", workerId);
                    channel.shutdownNow();
                }
            } catch (InterruptedException e) {
                logger.warn("Interrupted while closing channel to worker {}", workerId);
                Thread.currentThread().interrupt();
            }
        }
        
        workerChannels.clear();
        logger.info("All worker connections closed");
    }
    
    /**
     * Create a standard error response
     */
    private CommonProto.StandardResponse createErrorResponse(String message) {
        return CommonProto.StandardResponse.newBuilder()
                .setStatus(CommonProto.ResponseStatus.FAILED)
                .setRequestId(java.util.UUID.randomUUID().toString())
                .setTimestamp(com.google.protobuf.Timestamp.newBuilder()
                        .setSeconds(System.currentTimeMillis() / 1000)
                        .build())
                .putMetadata("error", message)
                .build();
    }
}