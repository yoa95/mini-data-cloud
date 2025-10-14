package com.minicloud.worker.grpc;

import com.minicloud.proto.dataexchange.DataExchangeProto.*;
import com.minicloud.worker.service.DataExchangeService;
import com.minicloud.worker.util.ArrowSerializationUtil;
import org.apache.arrow.memory.BufferAllocator;
import org.apache.arrow.memory.RootAllocator;
import org.apache.arrow.vector.IntVector;
import org.apache.arrow.vector.VarCharVector;
import org.apache.arrow.vector.VectorSchemaRoot;
import org.apache.arrow.vector.types.pojo.ArrowType;
import org.apache.arrow.vector.types.pojo.Field;
import org.apache.arrow.vector.types.pojo.FieldType;
import org.apache.arrow.vector.types.pojo.Schema;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration test for data exchange functionality between workers.
 * Tests Arrow RecordBatch serialization, compression, and transfer coordination.
 */
@SpringBootTest
public class DataExchangeIntegrationTest {
    
    @Autowired
    private DataExchangeService dataExchangeService;
    
    @Autowired
    private ArrowSerializationUtil arrowUtil;
    
    private BufferAllocator allocator;
    private VectorSchemaRoot testData;
    
    @BeforeEach
    void setUp() {
        allocator = new RootAllocator(Long.MAX_VALUE);
        testData = createTestData();
    }
    
    @AfterEach
    void tearDown() {
        if (testData != null) {
            testData.close();
        }
        if (allocator != null) {
            allocator.close();
        }
    }
    
    @Test
    void testArrowSerializationAndDeserialization() throws Exception {
        // Test serializing VectorSchemaRoot to chunks
        String transferId = "test-transfer-123";
        String queryId = "test-query-456";
        int stageId = 1;
        int partitionId = 0;
        
        List<DataChunk> chunks = arrowUtil.serializeToChunks(
                transferId, queryId, stageId, partitionId, testData);
        
        assertNotNull(chunks);
        assertFalse(chunks.isEmpty());
        
        // Verify chunk properties
        DataChunk firstChunk = chunks.get(0);
        assertEquals(transferId, firstChunk.getTransferId());
        assertEquals(queryId, firstChunk.getQueryId());
        assertEquals(stageId, firstChunk.getStageId());
        assertEquals(partitionId, firstChunk.getPartitionId());
        assertEquals(0, firstChunk.getChunkIndex());
        
        DataChunk lastChunk = chunks.get(chunks.size() - 1);
        assertTrue(lastChunk.getIsLastChunk());
        
        // Test deserializing chunks back to VectorSchemaRoot
        VectorSchemaRoot deserializedData = arrowUtil.deserializeFromChunks(chunks);
        assertNotNull(deserializedData);
        assertEquals(testData.getRowCount(), deserializedData.getRowCount());
        assertEquals(testData.getSchema().getFields().size(), 
                    deserializedData.getSchema().getFields().size());
    }
    
    @Test
    void testSchemaSerializationAndDeserialization() {
        // Test schema serialization
        ArrowSchema serializedSchema = arrowUtil.serializeSchema(testData.getSchema());
        assertNotNull(serializedSchema);
        assertFalse(serializedSchema.getSchemaBytes().isEmpty());
        assertFalse(serializedSchema.getSchemaFingerprint().isEmpty());
        
        // Test schema deserialization
        Schema deserializedSchema = arrowUtil.deserializeSchema(serializedSchema);
        assertNotNull(deserializedSchema);
        assertEquals(testData.getSchema().getFields().size(), 
                    deserializedSchema.getFields().size());
    }
    
    @Test
    void testStoreAndRetrieveIntermediateResults() {
        String queryId = "test-query-789";
        int stageId = 2;
        int partitionId = 1;
        
        // Store intermediate results
        dataExchangeService.storeIntermediateResults(queryId, stageId, partitionId, testData);
        
        // Retrieve available partitions
        List<PartitionInfo> partitions = dataExchangeService.getAvailablePartitions(queryId, stageId);
        assertNotNull(partitions);
        assertFalse(partitions.isEmpty());
        
        // Verify partition info
        PartitionInfo partitionInfo = partitions.stream()
                .filter(p -> p.getPartitionId() == partitionId)
                .findFirst()
                .orElse(null);
        
        assertNotNull(partitionInfo);
        assertEquals(partitionId, partitionInfo.getPartitionId());
        assertEquals(testData.getRowCount(), partitionInfo.getEstimatedRows());
        assertTrue(partitionInfo.getReadyForTransfer());
    }
    
    @Test
    void testHashPartitioning() {
        List<String> partitionColumns = Arrays.asList("id");
        int numPartitions = 3;
        
        var partitionedData = arrowUtil.hashPartitionData(testData, partitionColumns, numPartitions);
        
        assertNotNull(partitionedData);
        // In the simplified implementation, we expect at least one partition
        assertFalse(partitionedData.isEmpty());
        assertTrue(partitionedData.size() <= numPartitions);
    }
    
    @Test
    void testDataSizeEstimation() {
        long estimatedSize = arrowUtil.estimateDataSize(testData);
        assertTrue(estimatedSize > 0);
    }
    
    @Test
    void testAsyncDataTransfer() throws Exception {
        String targetWorkerId = "worker-test-target";
        String queryId = "test-query-async";
        int stageId = 3;
        int partitionId = 2;
        
        // Test async data transfer (will use mock implementation)
        CompletableFuture<DataTransferResponse> future = dataExchangeService.sendDataToWorker(
                targetWorkerId, queryId, stageId, partitionId, testData);
        
        assertNotNull(future);
        
        // Wait for completion with timeout
        DataTransferResponse response = future.get();
        assertNotNull(response);
        assertEquals(TransferStatus.TRANSFER_COMPLETED, response.getStatus());
        assertTrue(response.getTotalBytesTransferred() > 0);
        assertTrue(response.getTotalRowsTransferred() > 0);
    }
    
    @Test
    void testBroadcastOperation() throws Exception {
        String queryId = "test-query-broadcast";
        int stageId = 4;
        List<String> targetWorkerIds = Arrays.asList("worker-1", "worker-2", "worker-3");
        
        // Test broadcast operation (will use mock implementation)
        CompletableFuture<Void> future = dataExchangeService.performBroadcast(
                queryId, stageId, testData, targetWorkerIds);
        
        assertNotNull(future);
        
        // Wait for completion - should not throw exception
        assertDoesNotThrow(() -> future.get());
    }
    
    @Test
    void testHashShuffleOperation() throws Exception {
        String queryId = "test-query-shuffle";
        int stageId = 5;
        List<String> partitionColumns = Arrays.asList("id");
        List<String> targetWorkerIds = Arrays.asList("worker-1", "worker-2");
        
        // Test hash shuffle operation (will use mock implementation)
        CompletableFuture<Void> future = dataExchangeService.performHashShuffle(
                queryId, stageId, testData, partitionColumns, targetWorkerIds);
        
        assertNotNull(future);
        
        // Wait for completion - should not throw exception
        assertDoesNotThrow(() -> future.get());
    }
    
    @Test
    void testCleanupQueryData() {
        String queryId = "test-query-cleanup";
        int stageId = 6;
        int partitionId = 3;
        
        // Store some data
        dataExchangeService.storeIntermediateResults(queryId, stageId, partitionId, testData);
        
        // Verify data exists
        List<PartitionInfo> partitionsBefore = dataExchangeService.getAvailablePartitions(queryId, stageId);
        assertFalse(partitionsBefore.isEmpty());
        
        // Clean up
        dataExchangeService.cleanupQueryData(queryId);
        
        // Verify data is cleaned up
        List<PartitionInfo> partitionsAfter = dataExchangeService.getAvailablePartitions(queryId, stageId);
        assertTrue(partitionsAfter.isEmpty());
    }
    
    /**
     * Create test data with sample records
     */
    private VectorSchemaRoot createTestData() {
        // Create schema
        Field idField = new Field("id", FieldType.nullable(new ArrowType.Int(32, true)), null);
        Field nameField = new Field("name", FieldType.nullable(new ArrowType.Utf8()), null);
        Schema schema = new Schema(Arrays.asList(idField, nameField));
        
        // Create vectors
        VectorSchemaRoot root = VectorSchemaRoot.create(schema, allocator);
        IntVector idVector = (IntVector) root.getVector("id");
        VarCharVector nameVector = (VarCharVector) root.getVector("name");
        
        // Populate with test data
        int rowCount = 100;
        idVector.allocateNew(rowCount);
        nameVector.allocateNew(rowCount * 10, rowCount);
        
        for (int i = 0; i < rowCount; i++) {
            idVector.set(i, i);
            nameVector.set(i, ("name_" + i).getBytes());
        }
        
        idVector.setValueCount(rowCount);
        nameVector.setValueCount(rowCount);
        root.setRowCount(rowCount);
        
        return root;
    }
}