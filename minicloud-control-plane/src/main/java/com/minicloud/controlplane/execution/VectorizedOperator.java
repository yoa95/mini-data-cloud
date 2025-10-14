package com.minicloud.controlplane.execution;

import org.apache.arrow.memory.BufferAllocator;
import org.apache.arrow.vector.VectorSchemaRoot;

/**
 * Base interface for vectorized operators in the Arrow query execution engine.
 * All operators work with Arrow VectorSchemaRoot for columnar data processing.
 */
public interface VectorizedOperator extends AutoCloseable {
    
    /**
     * Executes the operator on the input data and returns the result.
     * 
     * @param input Input data as Arrow VectorSchemaRoot
     * @param allocator Buffer allocator for output vectors
     * @return Processed data as Arrow VectorSchemaRoot
     */
    VectorSchemaRoot execute(VectorSchemaRoot input, BufferAllocator allocator);
    
    /**
     * Gets the operator name for debugging and monitoring.
     */
    String getOperatorName();
    
    /**
     * Gets execution statistics for this operator.
     */
    OperatorStats getStats();
    
    /**
     * Closes the operator and releases resources.
     */
    @Override
    void close();
    
    /**
     * Statistics for operator execution.
     */
    class OperatorStats {
        private final long inputRows;
        private final long outputRows;
        private final long executionTimeMs;
        private final long memoryUsedBytes;
        
        public OperatorStats(long inputRows, long outputRows, long executionTimeMs, long memoryUsedBytes) {
            this.inputRows = inputRows;
            this.outputRows = outputRows;
            this.executionTimeMs = executionTimeMs;
            this.memoryUsedBytes = memoryUsedBytes;
        }
        
        public long getInputRows() { return inputRows; }
        public long getOutputRows() { return outputRows; }
        public long getExecutionTimeMs() { return executionTimeMs; }
        public long getMemoryUsedBytes() { return memoryUsedBytes; }
    }
}