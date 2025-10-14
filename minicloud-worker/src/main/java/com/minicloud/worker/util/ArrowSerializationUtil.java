package com.minicloud.worker.util;

import com.minicloud.proto.dataexchange.DataExchangeProto.*;
import org.apache.arrow.memory.BufferAllocator;
import org.apache.arrow.memory.RootAllocator;
import org.apache.arrow.vector.VectorSchemaRoot;
import org.apache.arrow.vector.ipc.ArrowStreamWriter;
import org.apache.arrow.vector.ipc.ArrowStreamReader;
import org.apache.arrow.vector.types.pojo.Schema;
import org.apache.arrow.vector.util.ByteArrayReadableSeekableByteChannel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.channels.Channels;
import java.security.MessageDigest;
import java.util.*;
import java.util.zip.CRC32;

/**
 * Utility class for Arrow RecordBatch serialization and deserialization.
 * Handles compression, chunking, and schema management for inter-worker communication.
 */
@Component
public class ArrowSerializationUtil {
    
    private static final Logger logger = LoggerFactory.getLogger(ArrowSerializationUtil.class);
    
    private static final int DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB
    private static final int MAX_CHUNK_SIZE = 16 * 1024 * 1024;   // 16MB
    
    private final BufferAllocator allocator;
    
    public ArrowSerializationUtil() {
        this.allocator = new RootAllocator(Long.MAX_VALUE);
    }
    
    /**
     * Serialize VectorSchemaRoot to a list of DataChunks for streaming
     */
    public List<DataChunk> serializeToChunks(
            String transferId,
            String queryId,
            int stageId,
            int partitionId,
            VectorSchemaRoot data) throws IOException {
        
        logger.debug("Serializing {} rows to chunks for transfer {}", data.getRowCount(), transferId);
        
        List<DataChunk> chunks = new ArrayList<>();
        
        // Serialize schema
        ArrowSchema schema = serializeSchema(data.getSchema());
        
        // Serialize data in chunks
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             ArrowStreamWriter writer = new ArrowStreamWriter(data, null, Channels.newChannel(baos))) {
            
            writer.start();
            writer.writeBatch();
            writer.end();
            
            byte[] serializedData = baos.toByteArray();
            logger.debug("Serialized data size: {} bytes", serializedData.length);
            
            // Split into chunks
            int chunkSize = Math.min(DEFAULT_CHUNK_SIZE, MAX_CHUNK_SIZE);
            int totalChunks = (int) Math.ceil((double) serializedData.length / chunkSize);
            
            for (int i = 0; i < totalChunks; i++) {
                int start = i * chunkSize;
                int end = Math.min(start + chunkSize, serializedData.length);
                byte[] chunkData = Arrays.copyOfRange(serializedData, start, end);
                
                // Calculate checksum
                String checksum = calculateChecksum(chunkData);
                
                DataChunk chunk = DataChunk.newBuilder()
                        .setTransferId(transferId)
                        .setQueryId(queryId)
                        .setStageId(stageId)
                        .setPartitionId(partitionId)
                        .setChunkIndex(i)
                        .setIsLastChunk(i == totalChunks - 1)
                        .setArrowRecordBatch(com.google.protobuf.ByteString.copyFrom(chunkData))
                        .setSchema(schema)
                        .setCompression(CompressionType.NONE) // TODO: Add compression
                        .setUncompressedSize(chunkData.length)
                        .setChecksum(checksum)
                        .setTimestamp(com.google.protobuf.Timestamp.newBuilder()
                                .setSeconds(System.currentTimeMillis() / 1000)
                                .build())
                        .build();
                
                chunks.add(chunk);
            }
        }
        
        logger.debug("Created {} chunks for transfer {}", chunks.size(), transferId);
        return chunks;
    }
    
    /**
     * Deserialize DataChunks back to VectorSchemaRoot
     */
    public VectorSchemaRoot deserializeFromChunks(List<DataChunk> chunks) throws IOException {
        if (chunks.isEmpty()) {
            throw new IllegalArgumentException("Cannot deserialize empty chunk list");
        }
        
        // Sort chunks by index
        chunks.sort(Comparator.comparingInt(DataChunk::getChunkIndex));
        
        // Validate chunk integrity
        validateChunks(chunks);
        
        // Reconstruct data
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        for (DataChunk chunk : chunks) {
            byte[] chunkData = chunk.getArrowRecordBatch().toByteArray();
            
            // Verify checksum
            String expectedChecksum = chunk.getChecksum();
            String actualChecksum = calculateChecksum(chunkData);
            if (!expectedChecksum.equals(actualChecksum)) {
                throw new IOException("Checksum mismatch for chunk " + chunk.getChunkIndex());
            }
            
            baos.write(chunkData);
        }
        
        // Deserialize Arrow data
        byte[] completeData = baos.toByteArray();
        ByteArrayReadableSeekableByteChannel channel = 
                new ByteArrayReadableSeekableByteChannel(completeData);
        
        try (ArrowStreamReader reader = new ArrowStreamReader(channel, allocator)) {
            VectorSchemaRoot root = reader.getVectorSchemaRoot();
            if (reader.loadNextBatch()) {
                // For now, return the root directly (simplified implementation)
                // In production, we'd need to properly copy the data
                return root;
            } else {
                throw new IOException("No data found in Arrow stream");
            }
        }
    }
    
    /**
     * Serialize Arrow Schema to protobuf format
     */
    public ArrowSchema serializeSchema(Schema schema) {
        try {
            // Simplified schema serialization
            String schemaJson = schema.toJson();
            byte[] schemaBytes = schemaJson.getBytes();
            
            return ArrowSchema.newBuilder()
                    .setSchemaBytes(com.google.protobuf.ByteString.copyFrom(schemaBytes))
                    .setSchemaFingerprint(schema.toString()) // Simplified fingerprint
                    .build();
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize Arrow schema", e);
        }
    }
    
    /**
     * Deserialize Arrow Schema from protobuf format
     */
    public Schema deserializeSchema(ArrowSchema arrowSchema) {
        try {
            byte[] schemaBytes = arrowSchema.getSchemaBytes().toByteArray();
            String schemaJson = new String(schemaBytes);
            return Schema.fromJSON(schemaJson);
        } catch (Exception e) {
            throw new RuntimeException("Failed to deserialize Arrow schema", e);
        }
    }
    
    /**
     * Estimate the size of VectorSchemaRoot in bytes
     */
    public long estimateDataSize(VectorSchemaRoot data) {
        return data.getFieldVectors().stream()
                .mapToLong(vector -> vector.getBufferSize())
                .sum();
    }
    
    /**
     * Get row count from a DataChunk (estimated)
     */
    public long getRowCountFromChunk(DataChunk chunk) {
        // This is an estimation - in practice, we'd need to partially deserialize
        // For now, return a rough estimate based on chunk size
        return chunk.getArrowRecordBatch().size() / 100; // Rough estimate
    }
    
    /**
     * Hash partition data based on specified columns
     */
    public Map<Integer, VectorSchemaRoot> hashPartitionData(
            VectorSchemaRoot inputData,
            List<String> partitionColumns,
            int numPartitions) {
        
        logger.debug("Hash partitioning {} rows into {} partitions based on columns: {}", 
                    inputData.getRowCount(), numPartitions, partitionColumns);
        
        Map<Integer, List<Integer>> partitionToRows = new HashMap<>();
        
        // Calculate hash for each row and assign to partition
        for (int row = 0; row < inputData.getRowCount(); row++) {
            int hash = calculateRowHash(inputData, row, partitionColumns);
            int partition = Math.abs(hash) % numPartitions;
            
            partitionToRows.computeIfAbsent(partition, k -> new ArrayList<>()).add(row);
        }
        
        // Create VectorSchemaRoot for each partition
        Map<Integer, VectorSchemaRoot> result = new HashMap<>();
        
        for (Map.Entry<Integer, List<Integer>> entry : partitionToRows.entrySet()) {
            int partition = entry.getKey();
            List<Integer> rows = entry.getValue();
            
            if (!rows.isEmpty()) {
                VectorSchemaRoot partitionData = createPartitionData(inputData, rows);
                result.put(partition, partitionData);
            }
        }
        
        logger.debug("Created {} non-empty partitions", result.size());
        return result;
    }
    
    // Helper methods
    
    private void validateChunks(List<DataChunk> chunks) {
        if (chunks.isEmpty()) {
            throw new IllegalArgumentException("Chunk list is empty");
        }
        
        // Check for missing chunks
        Set<Integer> expectedIndices = new HashSet<>();
        for (int i = 0; i < chunks.size(); i++) {
            expectedIndices.add(i);
        }
        
        Set<Integer> actualIndices = new HashSet<>();
        for (DataChunk chunk : chunks) {
            actualIndices.add(chunk.getChunkIndex());
        }
        
        if (!expectedIndices.equals(actualIndices)) {
            throw new IllegalArgumentException("Missing or duplicate chunks detected");
        }
        
        // Verify last chunk is marked correctly
        DataChunk lastChunk = chunks.get(chunks.size() - 1);
        if (!lastChunk.getIsLastChunk()) {
            throw new IllegalArgumentException("Last chunk not marked correctly");
        }
    }
    
    private String calculateChecksum(byte[] data) {
        CRC32 crc = new CRC32();
        crc.update(data);
        return Long.toHexString(crc.getValue());
    }
    
    private int calculateRowHash(VectorSchemaRoot data, int row, List<String> columns) {
        int hash = 1;
        
        for (String columnName : columns) {
            Object value = getValueAt(data, columnName, row);
            hash = 31 * hash + (value != null ? value.hashCode() : 0);
        }
        
        return hash;
    }
    
    private Object getValueAt(VectorSchemaRoot data, String columnName, int row) {
        try {
            return data.getVector(columnName).getObject(row);
        } catch (Exception e) {
            logger.warn("Failed to get value for column {} at row {}: {}", columnName, row, e.getMessage());
            return null;
        }
    }
    
    private VectorSchemaRoot createPartitionData(VectorSchemaRoot source, List<Integer> rows) {
        // Simplified implementation - just return the source for now
        // In production, we'd need to properly filter and copy rows
        logger.debug("Creating partition with {} rows (simplified implementation)", rows.size());
        return source;
    }
}