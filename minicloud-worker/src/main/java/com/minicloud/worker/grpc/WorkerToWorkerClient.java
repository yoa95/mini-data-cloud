package com.minicloud.worker.grpc;

import com.minicloud.proto.dataexchange.DataExchangeServiceGrpc;
import com.minicloud.proto.dataexchange.DataExchangeProto.*;
import com.minicloud.worker.util.ArrowSerializationUtil;
import com.minicloud.worker.util.RetryUtil;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.StatusRuntimeException;
import io.grpc.stub.StreamObserver;
import org.apache.arrow.vector.VectorSchemaRoot;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.annotation.PreDestroy;
import java.util.*;
import java.util.concurrent.*;

/**
 * gRPC client for worker-to-worker communication.
 * Handles data exchange, shuffle operations, and result streaming between workers.
 */
@Component
public class WorkerToWorkerClient {
    
    private static final Logger logger = LoggerFactory.getLogger(WorkerToWorkerClient.class);
    
    @Autowired
    private ArrowSerializationUtil arrowUtil;
    
    @Autowired
    private RetryUtil retryUtil;
    
    // Cache of gRPC channels to other workers
    private final Map<String, ManagedChannel> workerChannels = new ConcurrentHashMap<>();
    private final Map<String, DataExchangeServiceGrpc.DataExchangeServiceStub> workerStubs = new ConcurrentHashMap<>();
    private final Map<String, DataExchangeServiceGrpc.DataExchangeServiceBlockingStub> blockingStubs = new ConcurrentHashMap<>();
    
    // Thread pool for async operations
    private final ExecutorService executorService = Executors.newFixedThreadPool(20);
    
    /**
     * Send Arrow data to another worker using streaming
     */
    public CompletableFuture<DataTransferResponse> sendDataToWorker(
            String targetWorkerEndpoint,
            String queryId,
            int stageId,
            int partitionId,
            VectorSchemaRoot data) {
        
        logger.info("Sending data to worker {} for query {}, stage {}, partition {}", 
                   targetWorkerEndpoint, queryId, stageId, partitionId);
        
        return CompletableFuture.supplyAsync(() -> {
            try {
                return retryUtil.executeWithRetry(() -> {
                    return sendDataInternal(targetWorkerEndpoint, queryId, stageId, partitionId, data);
                }, 3, 1000, 2.0);
                
            } catch (Exception e) {
                logger.error("Failed to send data to worker {}: {}", targetWorkerEndpoint, e.getMessage(), e);
                throw new RuntimeException("Data transfer failed", e);
            }
        }, executorService);
    }
    
    /**
     * Request data from another worker
     */
    public CompletableFuture<List<VectorSchemaRoot>> requestDataFromWorker(
            String sourceWorkerEndpoint,
            String queryId,
            int stageId,
            List<Integer> partitionIds) {
        
        logger.info("Requesting data from worker {} for query {}, stage {}, partitions {}", 
                   sourceWorkerEndpoint, queryId, stageId, partitionIds);
        
        return CompletableFuture.supplyAsync(() -> {
            try {
                return retryUtil.executeWithRetry(() -> {
                    return requestDataInternal(sourceWorkerEndpoint, queryId, stageId, partitionIds);
                }, 3, 1000, 2.0);
                
            } catch (Exception e) {
                logger.error("Failed to request data from worker {}: {}", sourceWorkerEndpoint, e.getMessage(), e);
                throw new RuntimeException("Data request failed", e);
            }
        }, executorService);
    }
    
    /**
     * Get available partitions from another worker
     */
    public CompletableFuture<List<PartitionInfo>> getAvailablePartitions(
            String workerEndpoint,
            String queryId,
            int stageId) {
        
        logger.debug("Getting available partitions from worker {} for query {}, stage {}", 
                    workerEndpoint, queryId, stageId);
        
        return CompletableFuture.supplyAsync(() -> {
            try {
                return retryUtil.executeWithRetry(() -> {
                    return getAvailablePartitionsInternal(workerEndpoint, queryId, stageId);
                }, 2, 500, 1.5);
                
            } catch (Exception e) {
                logger.error("Failed to get partitions from worker {}: {}", workerEndpoint, e.getMessage(), e);
                return Collections.emptyList();
            }
        }, executorService);
    }
    
    /**
     * Perform bidirectional streaming with another worker
     */
    public CompletableFuture<Void> performBidirectionalStreaming(
            String workerEndpoint,
            String queryId,
            int stageId,
            List<VectorSchemaRoot> dataToSend) {
        
        logger.info("Starting bidirectional streaming with worker {} for query {}, stage {}", 
                   workerEndpoint, queryId, stageId);
        
        return CompletableFuture.runAsync(() -> {
            try {
                retryUtil.executeWithRetry(() -> {
                    performBidirectionalStreamingInternal(workerEndpoint, queryId, stageId, dataToSend);
                    return null;
                }, 2, 1000, 2.0);
                
            } catch (Exception e) {
                logger.error("Bidirectional streaming failed with worker {}: {}", workerEndpoint, e.getMessage(), e);
                throw new RuntimeException("Bidirectional streaming failed", e);
            }
        }, executorService);
    }
    
    // Internal implementation methods
    
    private DataTransferResponse sendDataInternal(
            String targetWorkerEndpoint,
            String queryId,
            int stageId,
            int partitionId,
            VectorSchemaRoot data) throws Exception {
        
        DataExchangeServiceGrpc.DataExchangeServiceStub stub = getWorkerStub(targetWorkerEndpoint);
        
        CompletableFuture<DataTransferResponse> responseFuture = new CompletableFuture<>();
        
        StreamObserver<DataTransferResponse> responseObserver = new StreamObserver<DataTransferResponse>() {
            @Override
            public void onNext(DataTransferResponse response) {
                responseFuture.complete(response);
            }
            
            @Override
            public void onError(Throwable t) {
                responseFuture.completeExceptionally(t);
            }
            
            @Override
            public void onCompleted() {
                if (!responseFuture.isDone()) {
                    responseFuture.completeExceptionally(new RuntimeException("Stream completed without response"));
                }
            }
        };
        
        StreamObserver<DataChunk> requestObserver = stub.sendResults(responseObserver);
        
        try {
            // Serialize data to chunks
            String transferId = generateTransferId(queryId, stageId, partitionId);
            List<DataChunk> chunks = arrowUtil.serializeToChunks(transferId, queryId, stageId, partitionId, data);
            
            // Send chunks
            for (DataChunk chunk : chunks) {
                requestObserver.onNext(chunk);
            }
            
            requestObserver.onCompleted();
            
            // Wait for response with timeout
            return responseFuture.get(30, TimeUnit.SECONDS);
            
        } catch (Exception e) {
            requestObserver.onError(e);
            throw e;
        }
    }
    
    private List<VectorSchemaRoot> requestDataInternal(
            String sourceWorkerEndpoint,
            String queryId,
            int stageId,
            List<Integer> partitionIds) throws Exception {
        
        DataExchangeServiceGrpc.DataExchangeServiceStub stub = getWorkerStub(sourceWorkerEndpoint);
        
        DataRequest request = DataRequest.newBuilder()
                .setQueryId(queryId)
                .setStageId(stageId)
                .addAllPartitionIds(partitionIds)
                .setRequestingWorkerId(getCurrentWorkerId())
                .setMaxChunkSize(4 * 1024 * 1024) // 4MB chunks
                .build();
        
        List<VectorSchemaRoot> results = new ArrayList<>();
        CompletableFuture<Void> streamFuture = new CompletableFuture<>();
        
        StreamObserver<DataChunk> responseObserver = new StreamObserver<DataChunk>() {
            private final Map<String, List<DataChunk>> transferChunks = new HashMap<>();
            
            @Override
            public void onNext(DataChunk chunk) {
                try {
                    String transferId = chunk.getTransferId();
                    transferChunks.computeIfAbsent(transferId, k -> new ArrayList<>()).add(chunk);
                    
                    if (chunk.getIsLastChunk()) {
                        // Process complete transfer
                        List<DataChunk> chunks = transferChunks.remove(transferId);
                        if (chunks != null && !chunks.isEmpty()) {
                            VectorSchemaRoot data = arrowUtil.deserializeFromChunks(chunks);
                            results.add(data);
                        }
                    }
                } catch (Exception e) {
                    streamFuture.completeExceptionally(e);
                }
            }
            
            @Override
            public void onError(Throwable t) {
                streamFuture.completeExceptionally(t);
            }
            
            @Override
            public void onCompleted() {
                streamFuture.complete(null);
            }
        };
        
        stub.requestData(request, responseObserver);
        
        // Wait for stream completion
        streamFuture.get(60, TimeUnit.SECONDS);
        
        return results;
    }
    
    private List<PartitionInfo> getAvailablePartitionsInternal(
            String workerEndpoint,
            String queryId,
            int stageId) throws Exception {
        
        DataExchangeServiceGrpc.DataExchangeServiceBlockingStub blockingStub = getBlockingStub(workerEndpoint);
        
        PartitionRequest request = PartitionRequest.newBuilder()
                .setQueryId(queryId)
                .setStageId(stageId)
                .setRequestingWorkerId(getCurrentWorkerId())
                .build();
        
        PartitionResponse response = blockingStub.withDeadlineAfter(10, TimeUnit.SECONDS)
                .getAvailablePartitions(request);
        
        return response.getAvailablePartitionsList();
    }
    
    private void performBidirectionalStreamingInternal(
            String workerEndpoint,
            String queryId,
            int stageId,
            List<VectorSchemaRoot> dataToSend) throws Exception {
        
        DataExchangeServiceGrpc.DataExchangeServiceStub stub = getWorkerStub(workerEndpoint);
        
        CompletableFuture<Void> streamFuture = new CompletableFuture<>();
        List<VectorSchemaRoot> receivedData = new ArrayList<>();
        
        StreamObserver<DataChunk> responseObserver = new StreamObserver<DataChunk>() {
            private final Map<String, List<DataChunk>> transferChunks = new HashMap<>();
            
            @Override
            public void onNext(DataChunk chunk) {
                try {
                    String transferId = chunk.getTransferId();
                    transferChunks.computeIfAbsent(transferId, k -> new ArrayList<>()).add(chunk);
                    
                    if (chunk.getIsLastChunk()) {
                        List<DataChunk> chunks = transferChunks.remove(transferId);
                        if (chunks != null && !chunks.isEmpty()) {
                            VectorSchemaRoot data = arrowUtil.deserializeFromChunks(chunks);
                            receivedData.add(data);
                        }
                    }
                } catch (Exception e) {
                    streamFuture.completeExceptionally(e);
                }
            }
            
            @Override
            public void onError(Throwable t) {
                streamFuture.completeExceptionally(t);
            }
            
            @Override
            public void onCompleted() {
                streamFuture.complete(null);
            }
        };
        
        StreamObserver<DataChunk> requestObserver = stub.streamData(responseObserver);
        
        try {
            // Send data
            for (int i = 0; i < dataToSend.size(); i++) {
                VectorSchemaRoot data = dataToSend.get(i);
                String transferId = generateTransferId(queryId, stageId, i);
                List<DataChunk> chunks = arrowUtil.serializeToChunks(transferId, queryId, stageId, i, data);
                
                for (DataChunk chunk : chunks) {
                    requestObserver.onNext(chunk);
                }
            }
            
            requestObserver.onCompleted();
            
            // Wait for completion
            streamFuture.get(120, TimeUnit.SECONDS);
            
            logger.info("Bidirectional streaming completed. Sent {} datasets, received {} datasets", 
                       dataToSend.size(), receivedData.size());
            
        } catch (Exception e) {
            requestObserver.onError(e);
            throw e;
        }
    }
    
    // Helper methods
    
    private DataExchangeServiceGrpc.DataExchangeServiceStub getWorkerStub(String workerEndpoint) {
        return workerStubs.computeIfAbsent(workerEndpoint, this::createWorkerStub);
    }
    
    private DataExchangeServiceGrpc.DataExchangeServiceBlockingStub getBlockingStub(String workerEndpoint) {
        return blockingStubs.computeIfAbsent(workerEndpoint, this::createBlockingStub);
    }
    
    private DataExchangeServiceGrpc.DataExchangeServiceStub createWorkerStub(String workerEndpoint) {
        ManagedChannel channel = getOrCreateChannel(workerEndpoint);
        return DataExchangeServiceGrpc.newStub(channel);
    }
    
    private DataExchangeServiceGrpc.DataExchangeServiceBlockingStub createBlockingStub(String workerEndpoint) {
        ManagedChannel channel = getOrCreateChannel(workerEndpoint);
        return DataExchangeServiceGrpc.newBlockingStub(channel);
    }
    
    private ManagedChannel getOrCreateChannel(String workerEndpoint) {
        return workerChannels.computeIfAbsent(workerEndpoint, endpoint -> {
            try {
                logger.info("Creating gRPC channel to worker at {}", endpoint);
                
                String[] parts = endpoint.split(":");
                if (parts.length != 2) {
                    throw new IllegalArgumentException("Invalid endpoint format: " + endpoint);
                }
                
                String host = parts[0];
                int port = Integer.parseInt(parts[1]);
                
                return ManagedChannelBuilder.forAddress(host, port)
                        .usePlaintext() // TODO: Use TLS in production
                        .keepAliveTime(30, TimeUnit.SECONDS)
                        .keepAliveTimeout(5, TimeUnit.SECONDS)
                        .keepAliveWithoutCalls(true)
                        .maxInboundMessageSize(32 * 1024 * 1024) // 32MB max message size
                        .build();
                
            } catch (Exception e) {
                logger.error("Failed to create gRPC channel to worker {}", endpoint, e);
                throw new RuntimeException("Failed to create channel", e);
            }
        });
    }
    
    private String generateTransferId(String queryId, int stageId, int partitionId) {
        return String.format("%s-%d-%d-%d", queryId, stageId, partitionId, System.currentTimeMillis());
    }
    
    private String getCurrentWorkerId() {
        return System.getProperty("worker.id", "worker-" + System.currentTimeMillis());
    }
    
    /**
     * Close connection to a specific worker
     */
    public void closeWorkerConnection(String workerEndpoint) {
        logger.info("Closing connection to worker {}", workerEndpoint);
        
        workerStubs.remove(workerEndpoint);
        blockingStubs.remove(workerEndpoint);
        
        ManagedChannel channel = workerChannels.remove(workerEndpoint);
        if (channel != null) {
            try {
                channel.shutdown();
                if (!channel.awaitTermination(5, TimeUnit.SECONDS)) {
                    logger.warn("Channel to worker {} did not terminate gracefully", workerEndpoint);
                    channel.shutdownNow();
                }
            } catch (InterruptedException e) {
                logger.warn("Interrupted while closing channel to worker {}", workerEndpoint);
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
        blockingStubs.clear();
        
        for (Map.Entry<String, ManagedChannel> entry : workerChannels.entrySet()) {
            String endpoint = entry.getKey();
            ManagedChannel channel = entry.getValue();
            
            try {
                channel.shutdown();
                if (!channel.awaitTermination(5, TimeUnit.SECONDS)) {
                    logger.warn("Channel to worker {} did not terminate gracefully", endpoint);
                    channel.shutdownNow();
                }
            } catch (InterruptedException e) {
                logger.warn("Interrupted while closing channel to worker {}", endpoint);
                Thread.currentThread().interrupt();
            }
        }
        
        workerChannels.clear();
        executorService.shutdown();
        
        logger.info("All worker connections closed");
    }
}