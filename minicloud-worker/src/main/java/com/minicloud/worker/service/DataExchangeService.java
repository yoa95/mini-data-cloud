package com.minicloud.worker.service;

import com.minicloud.proto.dataexchange.DataExchangeProto.*;
import org.apache.arrow.vector.VectorSchemaRoot;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Service for managing data exchange between workers.
 * Handles Arrow RecordBatch serialization, compression, and transfer coordination.
 */
@Service
public interface DataExchangeService {
    
    /**
     * Send Arrow data to another worker
     */
    CompletableFuture<DataTransferResponse> sendDataToWorker(
            String targetWorkerId, 
            String queryId, 
            int stageId, 
            int partitionId,
            VectorSchemaRoot data);
    
    /**
     * Request data from another worker
     */
    CompletableFuture<List<VectorSchemaRoot>> requestDataFromWorker(
            String sourceWorkerId,
            String queryId,
            int stageId,
            List<Integer> partitionIds);
    
    /**
     * Store intermediate results for other workers to access
     */
    void storeIntermediateResults(
            String queryId,
            int stageId,
            int partitionId,
            VectorSchemaRoot data);
    
    /**
     * Get available partitions for a query stage
     */
    List<PartitionInfo> getAvailablePartitions(String queryId, int stageId);
    
    /**
     * Perform hash-based shuffle operation
     */
    CompletableFuture<Void> performHashShuffle(
            String queryId,
            int stageId,
            VectorSchemaRoot inputData,
            List<String> partitionColumns,
            List<String> targetWorkerIds);
    
    /**
     * Perform broadcast operation to all workers
     */
    CompletableFuture<Void> performBroadcast(
            String queryId,
            int stageId,
            VectorSchemaRoot inputData,
            List<String> targetWorkerIds);
    
    /**
     * Clean up intermediate results for a completed query
     */
    void cleanupQueryData(String queryId);
}