package com.minicloud.common.util;

import org.apache.arrow.memory.BufferAllocator;
import org.apache.arrow.memory.RootAllocator;
import org.apache.arrow.vector.VectorSchemaRoot;
import org.apache.arrow.vector.ipc.ArrowStreamWriter;
import org.apache.arrow.vector.ipc.ArrowStreamReader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

/**
 * Utility methods for working with Apache Arrow data structures
 */
public class ArrowUtils {
    private static final Logger logger = LoggerFactory.getLogger(ArrowUtils.class);
    
    private static final BufferAllocator rootAllocator = new RootAllocator(Long.MAX_VALUE);

    /**
     * Get the shared root allocator for Arrow operations
     */
    public static BufferAllocator getRootAllocator() {
        return rootAllocator;
    }

    /**
     * Create a child allocator with the specified memory limit
     */
    public static BufferAllocator createChildAllocator(String name, long maxMemory) {
        return rootAllocator.newChildAllocator(name, 0, maxMemory);
    }

    /**
     * Serialize a VectorSchemaRoot to bytes using Arrow IPC format
     */
    public static byte[] serializeVectorSchemaRoot(VectorSchemaRoot root) throws IOException {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream();
             ArrowStreamWriter writer = new ArrowStreamWriter(root, null, out)) {
            
            writer.start();
            writer.writeBatch();
            writer.end();
            
            return out.toByteArray();
        }
    }

    /**
     * Deserialize bytes to a VectorSchemaRoot using Arrow IPC format
     */
    public static VectorSchemaRoot deserializeVectorSchemaRoot(byte[] data, BufferAllocator allocator) 
            throws IOException {
        try (ByteArrayInputStream in = new ByteArrayInputStream(data);
             ArrowStreamReader reader = new ArrowStreamReader(in, allocator)) {
            
            VectorSchemaRoot root = reader.getVectorSchemaRoot();
            if (reader.loadNextBatch()) {
                // Create a new root with the data loaded
                VectorSchemaRoot result = VectorSchemaRoot.create(root.getSchema(), allocator);
                for (int i = 0; i < root.getFieldVectors().size(); i++) {
                    var sourceVector = root.getFieldVectors().get(i);
                    var targetVector = result.getFieldVectors().get(i);
                    targetVector.copyFromSafe(0, 0, sourceVector);
                }
                result.setRowCount(root.getRowCount());
                return result;
            } else {
                return VectorSchemaRoot.create(root.getSchema(), allocator);
            }
        }
    }

    /**
     * Calculate the memory footprint of a VectorSchemaRoot
     */
    public static long calculateMemoryFootprint(VectorSchemaRoot root) {
        return root.getFieldVectors().stream()
                .mapToLong(vector -> vector.getBufferSize())
                .sum();
    }

    /**
     * Log memory usage statistics for debugging
     */
    public static void logMemoryUsage(String context, BufferAllocator allocator) {
        if (logger.isDebugEnabled()) {
            logger.debug("{}: Allocated={} MB, Peak={} MB, Limit={} MB",
                    context,
                    allocator.getAllocatedMemory() / (1024 * 1024),
                    allocator.getPeakMemoryAllocation() / (1024 * 1024),
                    allocator.getLimit() / (1024 * 1024));
        }
    }

    /**
     * Cleanup resources - should be called on application shutdown
     */
    public static void cleanup() {
        try {
            rootAllocator.close();
        } catch (Exception e) {
            logger.warn("Error closing root allocator", e);
        }
    }
}