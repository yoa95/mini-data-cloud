package com.minicloud.controlplane.storage;

import org.apache.arrow.memory.BufferAllocator;
import org.apache.arrow.memory.RootAllocator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration for storage-related components.
 */
@Configuration
public class StorageConfiguration {
    
    private static final Logger logger = LoggerFactory.getLogger(StorageConfiguration.class);
    
    /**
     * Creates a root Arrow memory allocator for the application.
     * This allocator will be used for all Arrow operations.
     */
    @Bean
    public BufferAllocator bufferAllocator() {
        try {
            // Set system properties to help with Arrow memory issues on Apple Silicon
            System.setProperty("arrow.memory.debug.allocator", "false");
            System.setProperty("io.netty.tryReflectionSetAccessible", "true");
            
            logger.info("Creating Arrow BufferAllocator with safer configuration");
            
            // Create root allocator with 512MB limit (smaller to avoid issues)
            BufferAllocator allocator = new RootAllocator(512 * 1024 * 1024L);
            
            logger.info("Successfully created Arrow BufferAllocator");
            return allocator;
            
        } catch (Exception e) {
            logger.error("Failed to create Arrow BufferAllocator, this may cause issues with query execution", e);
            // Still return an allocator, but log the issue
            return new RootAllocator(128 * 1024 * 1024L);
        }
    }
}