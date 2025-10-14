package com.minicloud.worker.grpc;

import com.minicloud.proto.metadata.MetadataServiceGrpc;
import com.minicloud.proto.metadata.MetadataProto.*;
import com.minicloud.proto.execution.WorkerManagementServiceGrpc;
import com.minicloud.proto.execution.QueryExecutionProto.*;
import com.minicloud.proto.common.CommonProto;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * gRPC client for communicating with the control plane.
 * This client allows workers to interact with metadata services and worker management operations.
 */
@Service
public class ControlPlaneClient {
    
    private static final Logger logger = LoggerFactory.getLogger(ControlPlaneClient.class);
    
    @GrpcClient("control-plane")
    private MetadataServiceGrpc.MetadataServiceBlockingStub metadataService;
    
    @GrpcClient("control-plane")
    private WorkerManagementServiceGrpc.WorkerManagementServiceBlockingStub workerManagementService;
    
    /**
     * Get table metadata from the control plane
     */
    public GetTableResponse getTable(String namespaceName, String tableName) {
        logger.info("Requesting table metadata for {}.{}", namespaceName, tableName);
        
        GetTableRequest request = GetTableRequest.newBuilder()
                .setNamespaceName(namespaceName)
                .setTableName(tableName)
                .build();
        
        try {
            GetTableResponse response = metadataService.getTable(request);
            logger.info("Successfully retrieved table metadata for {}.{}", namespaceName, tableName);
            return response;
        } catch (Exception e) {
            logger.error("Failed to get table metadata for {}.{}", namespaceName, tableName, e);
            throw new RuntimeException("Failed to get table metadata", e);
        }
    }
    
    /**
     * Register this worker with the control plane
     */
    public String registerWorker(String workerId, String endpoint, CommonProto.ResourceInfo resources, Map<String, String> metadata) {
        logger.info("Registering worker {} with control plane at endpoint {}", workerId, endpoint);
        
        RegisterWorkerRequest request = RegisterWorkerRequest.newBuilder()
                .setWorkerId(workerId)
                .setEndpoint(endpoint)
                .setResources(resources)
                .putAllMetadata(metadata != null ? metadata : Map.of())
                .build();
        
        try {
            RegisterWorkerResponse response = workerManagementService.registerWorker(request);
            
            if (response.getRegistered()) {
                logger.info("Worker registered successfully: {} -> {}", workerId, response.getAssignedWorkerId());
                return response.getAssignedWorkerId();
            } else {
                throw new RuntimeException("Worker registration failed: " + 
                        response.getResponse().getMetadataOrDefault("error", "Unknown error"));
            }
        } catch (Exception e) {
            logger.error("Failed to register worker {}", workerId, e);
            throw new RuntimeException("Failed to register worker", e);
        }
    }
    
    /**
     * Deregister this worker from the control plane
     */
    public boolean deregisterWorker(String workerId, String reason) {
        logger.info("Deregistering worker {} from control plane, reason: {}", workerId, reason);
        
        DeregisterWorkerRequest request = DeregisterWorkerRequest.newBuilder()
                .setWorkerId(workerId)
                .setReason(reason)
                .build();
        
        try {
            DeregisterWorkerResponse response = workerManagementService.deregisterWorker(request);
            
            if (response.getDeregistered()) {
                logger.info("Worker deregistered successfully: {}", workerId);
                return true;
            } else {
                logger.warn("Worker deregistration failed: {}", workerId);
                return false;
            }
        } catch (Exception e) {
            logger.error("Failed to deregister worker {}", workerId, e);
            return false;
        }
    }
    
    /**
     * Send heartbeat to the control plane
     */
    public boolean sendHeartbeat(String workerId, CommonProto.ResourceInfo resources, Map<String, String> statusMetadata) {
        logger.debug("Sending heartbeat for worker {}", workerId);
        
        HeartbeatRequest request = HeartbeatRequest.newBuilder()
                .setWorkerId(workerId)
                .setCurrentResources(resources)
                .setTimestamp(com.google.protobuf.Timestamp.newBuilder()
                        .setSeconds(System.currentTimeMillis() / 1000)
                        .setNanos((int) ((System.currentTimeMillis() % 1000) * 1_000_000))
                        .build())
                .putAllStatusMetadata(statusMetadata != null ? statusMetadata : Map.of())
                .build();
        
        try {
            HeartbeatResponse response = workerManagementService.heartbeat(request);
            
            if (response.getAcknowledged()) {
                logger.debug("Heartbeat acknowledged for worker {}", workerId);
                
                // Check if control plane has any instructions
                if (!response.getInstructionsMap().isEmpty()) {
                    logger.info("Received instructions from control plane: {}", response.getInstructionsMap());
                    // TODO: Process instructions (e.g., drain, shutdown)
                }
                
                return true;
            } else {
                logger.warn("Heartbeat not acknowledged for worker {}", workerId);
                return false;
            }
        } catch (Exception e) {
            logger.error("Failed to send heartbeat for worker {}", workerId, e);
            return false;
        }
    }
}