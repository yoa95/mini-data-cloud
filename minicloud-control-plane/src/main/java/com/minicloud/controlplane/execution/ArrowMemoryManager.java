package com.minicloud.controlplane.execution;

import org.apache.arrow.memory.BufferAllocator;
import org.apache.arrow.memory.RootAllocator;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;

/**
 * Manages Arrow memory allocation and buffer lifecycle.
 * Provides centralized memory management for Arrow operations.
 */
@Component
public class ArrowMemoryManager {
    
    private RootAllocator rootAllocator;
    private static final long DEFAULT_MEMORY_LIMIT = 1024 * 1024 * 1024L; // 1GB
    
    @PostConstruct
    public void initialize() {
        this.rootAllocator = new RootAllocator(DEFAULT_MEMORY_LIMIT);
    }
    
    @PreDestroy
    public void cleanup() {
        if (rootAllocator != null) {
            rootAllocator.close();
        }
    }
    
    /**
     * Creates a child allocator for query execution.
     * Each query should use its own allocator for proper resource isolation.
     */
    public BufferAllocator createQueryAllocator(String queryId) {
        return rootAllocator.newChildAllocator(
            "query-" + queryId, 
            0, 
            DEFAULT_MEMORY_LIMIT / 4 // 256MB per query
        );
    }
    
    /**
     * Creates a child allocator for operator execution.
     */
    public BufferAllocator createOperatorAllocator(BufferAllocator parent, String operatorName) {
        return parent.newChildAllocator(
            operatorName,
            0,
            parent.getLimit() / 2 // Half of parent's limit
        );
    }
    
    /**
     * Gets memory usage statistics.
     */
    public MemoryStats getMemoryStats() {
        return new MemoryStats(
            rootAllocator.getAllocatedMemory(),
            rootAllocator.getLimit(),
            rootAllocator.getPeakMemoryAllocation()
        );
    }
    
    public static class MemoryStats {
        private final long allocatedMemory;
        private final long memoryLimit;
        private final long peakMemory;
        
        public MemoryStats(long allocatedMemory, long memoryLimit, long peakMemory) {
            this.allocatedMemory = allocatedMemory;
            this.memoryLimit = memoryLimit;
            this.peakMemory = peakMemory;
        }
        
        public long getAllocatedMemory() { return allocatedMemory; }
        public long getMemoryLimit() { return memoryLimit; }
        public long getPeakMemory() { return peakMemory; }
    }
}