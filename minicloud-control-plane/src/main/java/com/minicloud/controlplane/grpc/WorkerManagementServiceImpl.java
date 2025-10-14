package com.minicloud.controlplane.grpc;

import com.minicloud.controlplane.service.WorkerRegistryService;
import com.minicloud.proto.execution.WorkerManagementServiceGrpc;
import com.minicloud.proto.execution.QueryExecutionProto.*;
import com.minicloud.proto.common.CommonProto;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * gRPC implementation of WorkerManagementService for worker registration and health monitoring.
 * This service handles worker lifecycle management in the control plane.
 */
@GrpcService
public class WorkerManagementServiceImpl extends WorkerManagementServiceGrpc.WorkerManagementServiceImplBase {
    
    private static final Logger logger = LoggerFactory.getLogger(WorkerManagementServiceImpl.class);
    
    @Autowired
    private WorkerRegistryService workerRegistryService;
    
    @Override
    public void registerWorker(RegisterWorkerRequest request, StreamObserver<RegisterWorkerResponse> responseObserver) {
        String requestedWorkerId = request.getWorkerId();
        String endpoint = request.getEndpoint();
        
        logger.info("Worker registration request: ID={}, endpoint={}", requestedWorkerId, endpoint);
        
        try {
            // Validate request
            if (endpoint == null || endpoint.isEmpty()) {
                throw new IllegalArgumentException("Worker endpoint cannot be empty");
            }
            
            // Register worker with the registry service
            String assignedWorkerId = workerRegistryService.registerWorker(
                    requestedWorkerId,
                    endpoint,
                    request.getResources(),
                    request.getMetadataMap()
            );
            
            RegisterWorkerResponse response = RegisterWorkerResponse.newBuilder()
                    .setRegistered(true)
                    .setAssignedWorkerId(assignedWorkerId)
                    .setResponse(createSuccessResponse())
                    .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
            
            logger.info("Worker registered successfully: {} -> {}", requestedWorkerId, assignedWorkerId);
            
        } catch (Exception e) {
            logger.error("Failed to register worker {}", requestedWorkerId, e);
            
            RegisterWorkerResponse errorResponse = RegisterWorkerResponse.newBuilder()
                    .setRegistered(false)
                    .setResponse(createErrorResponse(e.getMessage()))
                    .build();
            
            responseObserver.onNext(errorResponse);
            responseObserver.onCompleted();
        }
    }
    
    @Override
    public void deregisterWorker(DeregisterWorkerRequest request, StreamObserver<DeregisterWorkerResponse> responseObserver) {
        String workerId = request.getWorkerId();
        String reason = request.getReason();
        
        logger.info("Worker deregistration request: ID={}, reason={}", workerId, reason);
        
        try {
            boolean deregistered = workerRegistryService.deregisterWorker(workerId, reason);
            
            DeregisterWorkerResponse response = DeregisterWorkerResponse.newBuilder()
                    .setDeregistered(deregistered)
                    .setResponse(createSuccessResponse())
                    .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
            
            if (deregistered) {
                logger.info("Worker deregistered successfully: {}", workerId);
            } else {
                logger.warn("Worker deregistration failed - worker not found: {}", workerId);
            }
            
        } catch (Exception e) {
            logger.error("Failed to deregister worker {}", workerId, e);
            
            DeregisterWorkerResponse errorResponse = DeregisterWorkerResponse.newBuilder()
                    .setDeregistered(false)
                    .setResponse(createErrorResponse(e.getMessage()))
                    .build();
            
            responseObserver.onNext(errorResponse);
            responseObserver.onCompleted();
        }
    }
    
    @Override
    public void heartbeat(HeartbeatRequest request, StreamObserver<HeartbeatResponse> responseObserver) {
        String workerId = request.getWorkerId();
        
        logger.debug("Heartbeat received from worker: {}", workerId);
        
        try {
            boolean acknowledged = workerRegistryService.updateWorkerHeartbeat(
                    workerId,
                    request.getCurrentResources(),
                    request.getStatusMetadataMap()
            );
            
            HeartbeatResponse.Builder responseBuilder = HeartbeatResponse.newBuilder()
                    .setAcknowledged(acknowledged)
                    .setExpectedStatus(CommonProto.WorkerStatus.HEALTHY)
                    .setResponse(createSuccessResponse());
            
            // Add any instructions for the worker (e.g., drain requests, shutdown)
            // For now, no special instructions
            
            HeartbeatResponse response = responseBuilder.build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
            
            if (!acknowledged) {
                logger.warn("Heartbeat not acknowledged for unregistered worker: {}", workerId);
            }
            
        } catch (Exception e) {
            logger.error("Failed to process heartbeat from worker {}", workerId, e);
            
            HeartbeatResponse errorResponse = HeartbeatResponse.newBuilder()
                    .setAcknowledged(false)
                    .setExpectedStatus(CommonProto.WorkerStatus.UNHEALTHY)
                    .setResponse(createErrorResponse(e.getMessage()))
                    .build();
            
            responseObserver.onNext(errorResponse);
            responseObserver.onCompleted();
        }
    }
    
    @Override
    public void listWorkers(ListWorkersRequest request, StreamObserver<ListWorkersResponse> responseObserver) {
        logger.debug("List workers request with status filter: {}", request.getStatusFilter());
        
        try {
            // Note: HEALTHY is the default enum value (0), so we treat it as "no filter"
            CommonProto.WorkerStatus statusFilter = request.getStatusFilter() != CommonProto.WorkerStatus.HEALTHY ? request.getStatusFilter() : null;
            List<CommonProto.WorkerInfo> workers = workerRegistryService.getWorkers(statusFilter);
            
            // Apply pagination if requested
            int limit = request.getLimit();
            if (limit > 0 && workers.size() > limit) {
                workers = workers.subList(0, limit);
            }
            
            ListWorkersResponse response = ListWorkersResponse.newBuilder()
                    .addAllWorkers(workers)
                    .setResponse(createSuccessResponse())
                    .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
            
            logger.debug("Returned {} workers", workers.size());
            
        } catch (Exception e) {
            logger.error("Failed to list workers", e);
            
            ListWorkersResponse errorResponse = ListWorkersResponse.newBuilder()
                    .setResponse(createErrorResponse(e.getMessage()))
                    .build();
            
            responseObserver.onNext(errorResponse);
            responseObserver.onCompleted();
        }
    }
    
    private CommonProto.StandardResponse createSuccessResponse() {
        return CommonProto.StandardResponse.newBuilder()
                .setStatus(CommonProto.ResponseStatus.SUCCESS)
                .setRequestId(UUID.randomUUID().toString())
                .setTimestamp(com.google.protobuf.Timestamp.newBuilder()
                        .setSeconds(System.currentTimeMillis() / 1000)
                        .setNanos((int) ((System.currentTimeMillis() % 1000) * 1_000_000))
                        .build())
                .build();
    }
    
    private CommonProto.StandardResponse createErrorResponse(String errorMessage) {
        return CommonProto.StandardResponse.newBuilder()
                .setStatus(CommonProto.ResponseStatus.FAILED)
                .setRequestId(UUID.randomUUID().toString())
                .setTimestamp(com.google.protobuf.Timestamp.newBuilder()
                        .setSeconds(System.currentTimeMillis() / 1000)
                        .setNanos((int) ((System.currentTimeMillis() % 1000) * 1_000_000))
                        .build())
                .putMetadata("error", errorMessage)
                .build();
    }
}