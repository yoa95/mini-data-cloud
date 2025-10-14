package com.minicloud.controlplane.grpc;

import com.minicloud.proto.execution.QueryExecutionServiceGrpc;
import com.minicloud.proto.execution.QueryExecutionProto.*;
import com.minicloud.proto.common.CommonProto;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.annotation.PreDestroy;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * gRPC client for communicating with worker nodes.
 * This client allows the control plane to send query execution requests to workers.
 */
@Service
public class WorkerClient {
    
    private static final Logger logger = LoggerFactory.getLogger(WorkerClient.class);
    
    private final ConcurrentHashMap<String, ManagedChannel> workerChannels = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, QueryExecutionServiceGrpc.QueryExecutionServiceBlockingStub> workerStubs = new ConcurrentHashMap<>();
    
    /**
     * Execute a query stage on a specific worker
     */
    public ExecuteStageResponse executeStage(String workerEndpoint, ExecuteStageRequest request) {
        logger.info("Executing stage {} on worker {}", request.getStageId(), workerEndpoint);
        
        try {
            QueryExecutionServiceGrpc.QueryExecutionServiceBlockingStub stub = getWorkerStub(workerEndpoint);
            ExecuteStageResponse response = stub.executeStage(request);
            logger.info("Stage {} executed successfully on worker {}", request.getStageId(), workerEndpoint);
            return response;
        } catch (Exception e) {
            logger.error("Failed to execute stage {} on worker {}", request.getStageId(), workerEndpoint, e);
            throw new RuntimeException("Failed to execute stage on worker", e);
        }
    }
    
    /**
     * Check health of a specific worker
     */
    public HealthResponse checkWorkerHealth(String workerEndpoint, String workerId) {
        logger.debug("Checking health of worker {} at {}", workerId, workerEndpoint);
        
        try {
            QueryExecutionServiceGrpc.QueryExecutionServiceBlockingStub stub = getWorkerStub(workerEndpoint);
            HealthRequest request = HealthRequest.newBuilder()
                    .setWorkerId(workerId)
                    .build();
            
            HealthResponse response = stub.reportHealth(request);
            logger.debug("Health check successful for worker {} at {}", workerId, workerEndpoint);
            return response;
        } catch (Exception e) {
            logger.error("Failed to check health of worker {} at {}", workerId, workerEndpoint, e);
            throw new RuntimeException("Failed to check worker health", e);
        }
    }
    
    /**
     * Get or create a gRPC stub for a worker endpoint
     */
    private QueryExecutionServiceGrpc.QueryExecutionServiceBlockingStub getWorkerStub(String workerEndpoint) {
        return workerStubs.computeIfAbsent(workerEndpoint, endpoint -> {
            ManagedChannel channel = workerChannels.computeIfAbsent(endpoint, ep -> {
                logger.info("Creating gRPC channel to worker at {}", ep);
                return ManagedChannelBuilder.forTarget(ep)
                        .usePlaintext()
                        .build();
            });
            return QueryExecutionServiceGrpc.newBlockingStub(channel);
        });
    }
    
    /**
     * Close all worker connections on shutdown
     */
    @PreDestroy
    public void shutdown() {
        logger.info("Shutting down worker client connections");
        
        workerChannels.values().forEach(channel -> {
            try {
                channel.shutdown().awaitTermination(5, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                logger.warn("Interrupted while shutting down worker channel", e);
                Thread.currentThread().interrupt();
            }
        });
        
        workerChannels.clear();
        workerStubs.clear();
    }
}