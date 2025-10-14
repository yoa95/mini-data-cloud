package com.minicloud.controlplane.storage;

import org.apache.arrow.memory.BufferAllocator;
import org.apache.arrow.memory.RootAllocator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration for storage-related components.
 */
@Configuration
public class StorageConfiguration {
    
    /**
     * Creates a root Arrow memory allocator for the application.
     * This allocator will be used for all Arrow operations.
     */
    @Bean
    public BufferAllocator bufferAllocator() {
        // Create root allocator with 1GB limit
        return new RootAllocator(1024 * 1024 * 1024L);
    }
}