package com.minicloud.worker.grpc;

import com.minicloud.proto.dataexchange.DataExchangeServiceGrpc;
import com.minicloud.proto.dataexchange.DataExchangeProto.*;
import com.minicloud.proto.common.CommonProto;
import com.minicloud.worker.service.DataExchangeService;
import com.minicloud.worker.util.ArrowSerializationUtil;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;
import org.apache.arrow.vector.VectorSchemaRoot;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * gRPC implementation of DataExchangeService for inter-worker communication.
 * Handles streaming of Arrow RecordBatch data between workers.
 */
@GrpcService
public class DataExchangeGrpcServiceImpl extends DataExchangeServiceGrpc.DataExchangeServiceImplBase {
    
    private static final Logger logger = LoggerFactory.getLogger(DataExchangeGrpcServiceImpl.class);
    
    @Autowired
    private DataExchangeService dataExchangeService;
    
    @Autowired
    private ArrowSerializationUtil arrowUtil;
    
    // Track active streaming sessions
    private final Map<String, StreamingSession> activeSessions = new ConcurrentHashMap<>();
    private final AtomicLong sessionCounter = new AtomicLong(0);
    
    @Override
    public StreamObserver<DataChunk> streamData(StreamObserver<DataChunk> responseObserver) {
        String sessionId = "stream-" + sessionCounter.incrementAndGet();
        logger.info("Starting bidirectional data streaming session {}", sessionId);
        
        StreamingSession session = new StreamingSession(sessionId, responseObserver);
        activeSessions.put(sessionId, session);
        
        return new StreamObserver<DataChunk>() {
            private final List<DataChunk> receivedChunks = new ArrayList<>();
            private String currentTransferId = null;
            
            @Override
            public void onNext(DataChunk chunk) {
                try {
                    logger.debug("Received chunk {} for transfer {}", 
                               chunk.getChunkIndex(), chunk.getTransferId());
                    
                    // Track transfer ID
                    if (currentTransferId == null) {
                        currentTransferId = chunk.getTransferId();
                    } else if (!currentTransferId.equals(chunk.getTransferId())) {
                        logger.warn("Transfer ID mismatch: expected {}, got {}", 
                                   currentTransferId, chunk.getTransferId());
                    }
                    
                    receivedChunks.add(chunk);
                    
                    // If this is the last chunk, process the complete data
                    if (chunk.getIsLastChunk()) {
                        processReceivedData(receivedChunks, responseObserver);
                        receivedChunks.clear();
                        currentTransferId = null;
                    }
                    
                } catch (Exception e) {
                    logger.error("Error processing received chunk", e);
                    responseObserver.onError(e);
                }
            }
            
            @Override
            public void onError(Throwable t) {
                logger.error("Error in streaming session {}: {}", sessionId, t.getMessage(), t);
                activeSessions.remove(sessionId);
                session.markFailed(t);
            }
            
            @Override
            public void onCompleted() {
                logger.info("Streaming session {} completed", sessionId);
                activeSessions.remove(sessionId);
                session.markCompleted();
                responseObserver.onCompleted();
            }
        };
    }
    
    @Override
    public void requestData(DataRequest request, StreamObserver<DataChunk> responseObserver) {
        String queryId = request.getQueryId();
        int stageId = request.getStageId();
        List<Integer> partitionIds = request.getPartitionIdsList();
        
        logger.info("Data request for query {}, stage {}, partitions {}", 
                   queryId, stageId, partitionIds);
        
        try {
            // Get available partitions
            List<PartitionInfo> availablePartitions = dataExchangeService.getAvailablePartitions(queryId, stageId);
            
            // Filter requested partitions
            Set<Integer> requestedSet = new HashSet<>(partitionIds);
            List<PartitionInfo> matchingPartitions = availablePartitions.stream()
                    .filter(p -> requestedSet.contains(p.getPartitionId()))
                    .toList();
            
            if (matchingPartitions.isEmpty()) {
                logger.warn("No matching partitions found for request");
                responseObserver.onCompleted();
                return;
            }
            
            // Stream each partition's data
            for (PartitionInfo partition : matchingPartitions) {
                streamPartitionData(queryId, stageId, partition.getPartitionId(), responseObserver);
            }
            
            responseObserver.onCompleted();
            
        } catch (Exception e) {
            logger.error("Error processing data request", e);
            responseObserver.onError(e);
        }
    }
    
    @Override
    public StreamObserver<DataChunk> sendResults(StreamObserver<DataTransferResponse> responseObserver) {
        String transferId = "transfer-" + sessionCounter.incrementAndGet();
        logger.info("Starting result transfer {}", transferId);
        
        return new StreamObserver<DataChunk>() {
            private final List<DataChunk> chunks = new ArrayList<>();
            private long totalBytes = 0;
            private long totalRows = 0;
            
            @Override
            public void onNext(DataChunk chunk) {
                try {
                    logger.debug("Received result chunk {} for transfer {}", 
                               chunk.getChunkIndex(), chunk.getTransferId());
                    
                    chunks.add(chunk);
                    totalBytes += chunk.getArrowRecordBatch().size();
                    totalRows += arrowUtil.getRowCountFromChunk(chunk);
                    
                    // If this is the last chunk, store the complete data
                    if (chunk.getIsLastChunk()) {
                        storeReceivedResults(chunks);
                        
                        // Send response
                        DataTransferResponse response = DataTransferResponse.newBuilder()
                                .setTransferId(chunk.getTransferId())
                                .setStatus(TransferStatus.TRANSFER_COMPLETED)
                                .setTotalBytesTransferred(totalBytes)
                                .setTotalRowsTransferred(totalRows)
                                .setTotalChunks(chunks.size())
                                .setResponse(createSuccessResponse())
                                .build();
                        
                        responseObserver.onNext(response);
                    }
                    
                } catch (Exception e) {
                    logger.error("Error processing result chunk", e);
                    
                    DataTransferResponse errorResponse = DataTransferResponse.newBuilder()
                            .setTransferId(transferId)
                            .setStatus(TransferStatus.TRANSFER_FAILED)
                            .setErrorMessage(e.getMessage())
                            .setResponse(createErrorResponse(e.getMessage()))
                            .build();
                    
                    responseObserver.onNext(errorResponse);
                }
            }
            
            @Override
            public void onError(Throwable t) {
                logger.error("Error in result transfer {}: {}", transferId, t.getMessage(), t);
                
                DataTransferResponse errorResponse = DataTransferResponse.newBuilder()
                        .setTransferId(transferId)
                        .setStatus(TransferStatus.TRANSFER_FAILED)
                        .setErrorMessage(t.getMessage())
                        .setResponse(createErrorResponse(t.getMessage()))
                        .build();
                
                responseObserver.onNext(errorResponse);
                responseObserver.onCompleted();
            }
            
            @Override
            public void onCompleted() {
                logger.info("Result transfer {} completed", transferId);
                responseObserver.onCompleted();
            }
        };
    }
    
    @Override
    public void getAvailablePartitions(PartitionRequest request, StreamObserver<PartitionResponse> responseObserver) {
        String queryId = request.getQueryId();
        int stageId = request.getStageId();
        
        logger.debug("Getting available partitions for query {}, stage {}", queryId, stageId);
        
        try {
            List<PartitionInfo> partitions = dataExchangeService.getAvailablePartitions(queryId, stageId);
            
            PartitionResponse response = PartitionResponse.newBuilder()
                    .addAllAvailablePartitions(partitions)
                    .setResponse(createSuccessResponse())
                    .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
            
        } catch (Exception e) {
            logger.error("Error getting available partitions", e);
            responseObserver.onError(e);
        }
    }
    
    // Helper methods
    
    private void processReceivedData(List<DataChunk> chunks, StreamObserver<DataChunk> responseObserver) {
        try {
            if (chunks.isEmpty()) {
                return;
            }
            
            DataChunk firstChunk = chunks.get(0);
            String queryId = firstChunk.getQueryId();
            int stageId = firstChunk.getStageId();
            int partitionId = firstChunk.getPartitionId();
            
            logger.debug("Processing {} chunks for query {}, stage {}, partition {}", 
                        chunks.size(), queryId, stageId, partitionId);
            
            // Deserialize Arrow data
            VectorSchemaRoot data = arrowUtil.deserializeFromChunks(chunks);
            
            // Store as intermediate results
            dataExchangeService.storeIntermediateResults(queryId, stageId, partitionId, data);
            
            // Send acknowledgment chunk
            DataChunk ackChunk = DataChunk.newBuilder()
                    .setTransferId(firstChunk.getTransferId())
                    .setQueryId(queryId)
                    .setStageId(stageId)
                    .setPartitionId(partitionId)
                    .setChunkIndex(0)
                    .setIsLastChunk(true)
                    .setArrowRecordBatch(com.google.protobuf.ByteString.copyFromUtf8("ACK"))
                    .setTimestamp(com.google.protobuf.Timestamp.newBuilder()
                            .setSeconds(System.currentTimeMillis() / 1000)
                            .build())
                    .build();
            
            responseObserver.onNext(ackChunk);
            
        } catch (Exception e) {
            logger.error("Error processing received data", e);
            throw new RuntimeException("Failed to process received data", e);
        }
    }
    
    private void streamPartitionData(String queryId, int stageId, int partitionId, 
                                   StreamObserver<DataChunk> responseObserver) {
        try {
            // Get stored data for this partition
            // This is a simplified implementation - in practice, we'd retrieve from storage
            logger.debug("Streaming partition data for query {}, stage {}, partition {}", 
                        queryId, stageId, partitionId);
            
            // For now, send empty acknowledgment
            DataChunk chunk = DataChunk.newBuilder()
                    .setTransferId("stream-" + System.currentTimeMillis())
                    .setQueryId(queryId)
                    .setStageId(stageId)
                    .setPartitionId(partitionId)
                    .setChunkIndex(0)
                    .setIsLastChunk(true)
                    .setArrowRecordBatch(com.google.protobuf.ByteString.copyFromUtf8("NO_DATA"))
                    .setTimestamp(com.google.protobuf.Timestamp.newBuilder()
                            .setSeconds(System.currentTimeMillis() / 1000)
                            .build())
                    .build();
            
            responseObserver.onNext(chunk);
            
        } catch (Exception e) {
            logger.error("Error streaming partition data", e);
            throw new RuntimeException("Failed to stream partition data", e);
        }
    }
    
    private void storeReceivedResults(List<DataChunk> chunks) {
        try {
            if (chunks.isEmpty()) {
                return;
            }
            
            DataChunk firstChunk = chunks.get(0);
            String queryId = firstChunk.getQueryId();
            int stageId = firstChunk.getStageId();
            int partitionId = firstChunk.getPartitionId();
            
            // Deserialize and store
            VectorSchemaRoot data = arrowUtil.deserializeFromChunks(chunks);
            dataExchangeService.storeIntermediateResults(queryId, stageId, partitionId, data);
            
            logger.info("Stored {} rows for query {}, stage {}, partition {}", 
                       data.getRowCount(), queryId, stageId, partitionId);
            
        } catch (Exception e) {
            logger.error("Error storing received results", e);
            throw new RuntimeException("Failed to store received results", e);
        }
    }
    
    private CommonProto.StandardResponse createSuccessResponse() {
        return CommonProto.StandardResponse.newBuilder()
                .setStatus(CommonProto.ResponseStatus.SUCCESS)
                .setRequestId(UUID.randomUUID().toString())
                .setTimestamp(com.google.protobuf.Timestamp.newBuilder()
                        .setSeconds(System.currentTimeMillis() / 1000)
                        .build())
                .build();
    }
    
    private CommonProto.StandardResponse createErrorResponse(String message) {
        return CommonProto.StandardResponse.newBuilder()
                .setStatus(CommonProto.ResponseStatus.FAILED)
                .setRequestId(UUID.randomUUID().toString())
                .setTimestamp(com.google.protobuf.Timestamp.newBuilder()
                        .setSeconds(System.currentTimeMillis() / 1000)
                        .build())
                .putMetadata("error", message)
                .build();
    }
    
    /**
     * Internal class to track streaming sessions
     */
    private static class StreamingSession {
        private final String sessionId;
        private final StreamObserver<DataChunk> responseObserver;
        private final long startTime;
        private volatile boolean completed = false;
        private volatile boolean failed = false;
        private volatile Throwable error;
        
        public StreamingSession(String sessionId, StreamObserver<DataChunk> responseObserver) {
            this.sessionId = sessionId;
            this.responseObserver = responseObserver;
            this.startTime = System.currentTimeMillis();
        }
        
        public void markCompleted() {
            this.completed = true;
        }
        
        public void markFailed(Throwable error) {
            this.failed = true;
            this.error = error;
        }
        
        // Getters
        public String getSessionId() { return sessionId; }
        public boolean isCompleted() { return completed; }
        public boolean isFailed() { return failed; }
        public Throwable getError() { return error; }
        public long getStartTime() { return startTime; }
    }
}