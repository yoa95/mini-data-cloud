package com.minicloud.worker.service;

import com.minicloud.proto.dataexchange.DataExchangeProto.*;
import com.minicloud.worker.util.ArrowSerializationUtil;
import com.minicloud.worker.util.RetryUtil;
import org.apache.arrow.vector.VectorSchemaRoot;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Implementation of DataExchangeService for inter-worker communication.
 * Handles Arrow RecordBatch serialization, compression, and transfer coordination.
 */
@Service
public class DataExchangeServiceImpl implements DataExchangeService {
    
    private static final Logger logger = LoggerFactory.getLogger(DataExchangeServiceImpl.class);
    
    @Autowired
    private ArrowSerializationUtil arrowUtil;
    
    @Autowired
    private RetryUtil retryUtil;
    
    // Storage for intermediate results
    private final Map<String, Map<Integer, VectorSchemaRoot>> intermediateResults = new ConcurrentHashMap<>();
    
    // Active data transfers
    private final Map<String, DataTransferState> activeTransfers = new ConcurrentHashMap<>();
    
    // Thread pool for async operations
    private final ExecutorService executorService = Executors.newFixedThreadPool(10);
    
    @Override
    public CompletableFuture<DataTransferResponse> sendDataToWorker(
            String targetWorkerId, 
            String queryId, 
            int stageId, 
            int partitionId,
            VectorSchemaRoot data) {
        
        String transferId = generateTransferId(queryId, stageId, partitionId);
        logger.info("Starting data transfer {} to worker {}", transferId, targetWorkerId);
        
        return CompletableFuture.supplyAsync(() -> {
            try {
                // Create transfer state
                DataTransferState transferState = new DataTransferState(transferId, targetWorkerId);
                activeTransfers.put(transferId, transferState);
                
                // Serialize Arrow data to chunks
                List<DataChunk> chunks = arrowUtil.serializeToChunks(
                        transferId, queryId, stageId, partitionId, data);
                
                logger.debug("Serialized data into {} chunks for transfer {}", chunks.size(), transferId);
                
                // Send chunks with retry logic
                return retryUtil.executeWithRetry(() -> {
                    return sendChunksToWorker(targetWorkerId, chunks, transferState);
                }, 3, 1000, 2.0);
                
            } catch (Exception e) {
                logger.error("Failed to send data to worker {}: {}", targetWorkerId, e.getMessage(), e);
                return DataTransferResponse.newBuilder()
                        .setTransferId(transferId)
                        .setStatus(TransferStatus.TRANSFER_FAILED)
                        .setErrorMessage(e.getMessage())
                        .build();
            } finally {
                activeTransfers.remove(transferId);
            }
        }, executorService);
    }
    
    @Override
    public CompletableFuture<List<VectorSchemaRoot>> requestDataFromWorker(
            String sourceWorkerId,
            String queryId,
            int stageId,
            List<Integer> partitionIds) {
        
        logger.info("Requesting data from worker {} for query {}, stage {}, partitions {}", 
                   sourceWorkerId, queryId, stageId, partitionIds);
        
        return CompletableFuture.supplyAsync(() -> {
            try {
                // Create data request
                DataRequest request = DataRequest.newBuilder()
                        .setQueryId(queryId)
                        .setStageId(stageId)
                        .addAllPartitionIds(partitionIds)
                        .setRequestingWorkerId(getCurrentWorkerId())
                        .setMaxChunkSize(4 * 1024 * 1024) // 4MB chunks
                        .build();
                
                // Request data with retry logic
                return retryUtil.executeWithRetry(() -> {
                    return requestDataFromWorkerInternal(sourceWorkerId, request);
                }, 3, 1000, 2.0);
                
            } catch (Exception e) {
                logger.error("Failed to request data from worker {}: {}", sourceWorkerId, e.getMessage(), e);
                throw new RuntimeException("Data request failed", e);
            }
        }, executorService);
    }
    
    @Override
    public void storeIntermediateResults(
            String queryId,
            int stageId,
            int partitionId,
            VectorSchemaRoot data) {
        
        String key = queryId + ":" + stageId;
        logger.debug("Storing intermediate results for query {}, stage {}, partition {}", 
                    queryId, stageId, partitionId);
        
        intermediateResults.computeIfAbsent(key, k -> new ConcurrentHashMap<>())
                          .put(partitionId, data);
        
        logger.debug("Stored {} rows for partition {}", data.getRowCount(), partitionId);
    }
    
    @Override
    public List<PartitionInfo> getAvailablePartitions(String queryId, int stageId) {
        String key = queryId + ":" + stageId;
        Map<Integer, VectorSchemaRoot> partitions = intermediateResults.get(key);
        
        if (partitions == null) {
            return Collections.emptyList();
        }
        
        List<PartitionInfo> partitionInfos = new ArrayList<>();
        for (Map.Entry<Integer, VectorSchemaRoot> entry : partitions.entrySet()) {
            VectorSchemaRoot data = entry.getValue();
            
            PartitionInfo info = PartitionInfo.newBuilder()
                    .setPartitionId(entry.getKey())
                    .setEstimatedRows(data.getRowCount())
                    .setEstimatedBytes(arrowUtil.estimateDataSize(data))
                    .setSchema(arrowUtil.serializeSchema(data.getSchema()))
                    .setReadyForTransfer(true)
                    .setCreatedAt(com.google.protobuf.Timestamp.newBuilder()
                            .setSeconds(System.currentTimeMillis() / 1000)
                            .build())
                    .build();
            
            partitionInfos.add(info);
        }
        
        return partitionInfos;
    }
    
    @Override
    public CompletableFuture<Void> performHashShuffle(
            String queryId,
            int stageId,
            VectorSchemaRoot inputData,
            List<String> partitionColumns,
            List<String> targetWorkerIds) {
        
        logger.info("Performing hash shuffle for query {}, stage {} with {} target workers", 
                   queryId, stageId, targetWorkerIds.size());
        
        return CompletableFuture.runAsync(() -> {
            try {
                // Partition data based on hash of partition columns
                Map<Integer, VectorSchemaRoot> partitionedData = 
                        arrowUtil.hashPartitionData(inputData, partitionColumns, targetWorkerIds.size());
                
                // Send each partition to corresponding worker
                List<CompletableFuture<DataTransferResponse>> transfers = new ArrayList<>();
                
                for (Map.Entry<Integer, VectorSchemaRoot> entry : partitionedData.entrySet()) {
                    int partitionIndex = entry.getKey();
                    VectorSchemaRoot partitionData = entry.getValue();
                    String targetWorkerId = targetWorkerIds.get(partitionIndex % targetWorkerIds.size());
                    
                    CompletableFuture<DataTransferResponse> transfer = sendDataToWorker(
                            targetWorkerId, queryId, stageId, partitionIndex, partitionData);
                    transfers.add(transfer);
                }
                
                // Wait for all transfers to complete
                CompletableFuture.allOf(transfers.toArray(new CompletableFuture[0])).join();
                
                logger.info("Hash shuffle completed for query {}, stage {}", queryId, stageId);
                
            } catch (Exception e) {
                logger.error("Hash shuffle failed for query {}, stage {}: {}", 
                           queryId, stageId, e.getMessage(), e);
                throw new RuntimeException("Hash shuffle failed", e);
            }
        }, executorService);
    }
    
    @Override
    public CompletableFuture<Void> performBroadcast(
            String queryId,
            int stageId,
            VectorSchemaRoot inputData,
            List<String> targetWorkerIds) {
        
        logger.info("Performing broadcast for query {}, stage {} to {} workers", 
                   queryId, stageId, targetWorkerIds.size());
        
        return CompletableFuture.runAsync(() -> {
            try {
                // Send same data to all target workers
                List<CompletableFuture<DataTransferResponse>> transfers = new ArrayList<>();
                
                for (String targetWorkerId : targetWorkerIds) {
                    CompletableFuture<DataTransferResponse> transfer = sendDataToWorker(
                            targetWorkerId, queryId, stageId, 0, inputData);
                    transfers.add(transfer);
                }
                
                // Wait for all transfers to complete
                CompletableFuture.allOf(transfers.toArray(new CompletableFuture[0])).join();
                
                logger.info("Broadcast completed for query {}, stage {}", queryId, stageId);
                
            } catch (Exception e) {
                logger.error("Broadcast failed for query {}, stage {}: {}", 
                           queryId, stageId, e.getMessage(), e);
                throw new RuntimeException("Broadcast failed", e);
            }
        }, executorService);
    }
    
    @Override
    public void cleanupQueryData(String queryId) {
        logger.info("Cleaning up data for query {}", queryId);
        
        // Remove all intermediate results for this query
        intermediateResults.entrySet().removeIf(entry -> entry.getKey().startsWith(queryId + ":"));
        
        // Cancel any active transfers for this query
        activeTransfers.entrySet().removeIf(entry -> entry.getValue().getQueryId().equals(queryId));
        
        logger.debug("Cleanup completed for query {}", queryId);
    }
    
    // Helper methods
    
    private DataTransferResponse sendChunksToWorker(
            String targetWorkerId, 
            List<DataChunk> chunks, 
            DataTransferState transferState) {
        
        // TODO: Implement actual gRPC streaming to target worker
        // For now, simulate successful transfer
        
        long totalBytes = chunks.stream().mapToLong(chunk -> chunk.getArrowRecordBatch().size()).sum();
        long totalRows = chunks.stream().mapToLong(chunk -> 
                arrowUtil.getRowCountFromChunk(chunk)).sum();
        
        transferState.markCompleted(totalBytes, totalRows, chunks.size());
        
        return DataTransferResponse.newBuilder()
                .setTransferId(transferState.getTransferId())
                .setStatus(TransferStatus.TRANSFER_COMPLETED)
                .setTotalBytesTransferred(totalBytes)
                .setTotalRowsTransferred(totalRows)
                .setTotalChunks(chunks.size())
                .build();
    }
    
    private List<VectorSchemaRoot> requestDataFromWorkerInternal(
            String sourceWorkerId, 
            DataRequest request) {
        
        // TODO: Implement actual gRPC request to source worker
        // For now, return empty list
        
        logger.debug("Requesting data from worker {} (simulated)", sourceWorkerId);
        return Collections.emptyList();
    }
    
    private String generateTransferId(String queryId, int stageId, int partitionId) {
        return String.format("%s-%d-%d-%d", queryId, stageId, partitionId, System.currentTimeMillis());
    }
    
    private String getCurrentWorkerId() {
        // TODO: Get actual worker ID from configuration
        return "worker-" + System.getProperty("worker.id", "unknown");
    }
    
    /**
     * Internal class to track data transfer state
     */
    private static class DataTransferState {
        private final String transferId;
        private final String targetWorkerId;
        private final String queryId;
        private final long startTime;
        private volatile TransferStatus status;
        private volatile long totalBytes;
        private volatile long totalRows;
        private volatile int totalChunks;
        
        public DataTransferState(String transferId, String targetWorkerId) {
            this.transferId = transferId;
            this.targetWorkerId = targetWorkerId;
            this.queryId = extractQueryId(transferId);
            this.startTime = System.currentTimeMillis();
            this.status = TransferStatus.TRANSFER_STARTED;
        }
        
        public void markCompleted(long bytes, long rows, int chunks) {
            this.status = TransferStatus.TRANSFER_COMPLETED;
            this.totalBytes = bytes;
            this.totalRows = rows;
            this.totalChunks = chunks;
        }
        
        public void markFailed() {
            this.status = TransferStatus.TRANSFER_FAILED;
        }
        
        // Getters
        public String getTransferId() { return transferId; }
        public String getTargetWorkerId() { return targetWorkerId; }
        public String getQueryId() { return queryId; }
        public TransferStatus getStatus() { return status; }
        public long getTotalBytes() { return totalBytes; }
        public long getTotalRows() { return totalRows; }
        public int getTotalChunks() { return totalChunks; }
        public long getStartTime() { return startTime; }
        
        private String extractQueryId(String transferId) {
            // Extract query ID from transfer ID format: queryId-stageId-partitionId-timestamp
            String[] parts = transferId.split("-");
            return parts.length > 0 ? parts[0] : "unknown";
        }
    }
}