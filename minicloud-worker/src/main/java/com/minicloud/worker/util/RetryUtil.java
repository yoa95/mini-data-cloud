package com.minicloud.worker.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.concurrent.Callable;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Predicate;

/**
 * Utility class for implementing retry logic with exponential backoff.
 * Used for handling transient failures in inter-worker communication.
 */
@Component
public class RetryUtil {
    
    private static final Logger logger = LoggerFactory.getLogger(RetryUtil.class);
    
    /**
     * Execute a callable with retry logic and exponential backoff
     */
    public <T> T executeWithRetry(
            Callable<T> operation,
            int maxRetries,
            long initialDelayMs,
            double backoffMultiplier) throws Exception {
        
        return executeWithRetry(operation, maxRetries, initialDelayMs, backoffMultiplier, 
                               this::isRetryableException);
    }
    
    /**
     * Execute a callable with retry logic, exponential backoff, and custom retry predicate
     */
    public <T> T executeWithRetry(
            Callable<T> operation,
            int maxRetries,
            long initialDelayMs,
            double backoffMultiplier,
            Predicate<Exception> shouldRetry) throws Exception {
        
        Exception lastException = null;
        long currentDelay = initialDelayMs;
        
        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    logger.debug("Retry attempt {} after {}ms delay", attempt, currentDelay);
                    Thread.sleep(currentDelay);
                }
                
                return operation.call();
                
            } catch (Exception e) {
                lastException = e;
                
                if (attempt == maxRetries) {
                    logger.error("Operation failed after {} attempts", maxRetries + 1, e);
                    break;
                }
                
                if (!shouldRetry.test(e)) {
                    logger.error("Non-retryable exception encountered", e);
                    throw e;
                }
                
                logger.warn("Operation failed on attempt {}, will retry: {}", 
                           attempt + 1, e.getMessage());
                
                // Calculate next delay with jitter
                currentDelay = calculateNextDelay(currentDelay, backoffMultiplier);
            }
        }
        
        throw new RuntimeException("Operation failed after " + (maxRetries + 1) + " attempts", lastException);
    }
    
    /**
     * Execute a runnable with retry logic
     */
    public void executeWithRetry(
            Runnable operation,
            int maxRetries,
            long initialDelayMs,
            double backoffMultiplier) throws Exception {
        
        executeWithRetry(() -> {
            operation.run();
            return null;
        }, maxRetries, initialDelayMs, backoffMultiplier);
    }
    
    /**
     * Determine if an exception should trigger a retry
     */
    private boolean isRetryableException(Exception e) {
        // Network-related exceptions that are typically transient
        String message = e.getMessage();
        if (message != null) {
            String lowerMessage = message.toLowerCase();
            
            // Connection issues
            if (lowerMessage.contains("connection refused") ||
                lowerMessage.contains("connection reset") ||
                lowerMessage.contains("connection timeout") ||
                lowerMessage.contains("network is unreachable") ||
                lowerMessage.contains("host is unreachable")) {
                return true;
            }
            
            // Temporary server issues
            if (lowerMessage.contains("service unavailable") ||
                lowerMessage.contains("server overloaded") ||
                lowerMessage.contains("temporary failure") ||
                lowerMessage.contains("try again")) {
                return true;
            }
            
            // gRPC specific errors
            if (lowerMessage.contains("unavailable") ||
                lowerMessage.contains("deadline exceeded") ||
                lowerMessage.contains("resource exhausted")) {
                return true;
            }
        }
        
        // Exception types that are typically retryable
        String className = e.getClass().getSimpleName().toLowerCase();
        if (className.contains("timeout") ||
            className.contains("connection") ||
            className.contains("socket") ||
            className.contains("io")) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Calculate next delay with exponential backoff and jitter
     */
    private long calculateNextDelay(long currentDelay, double backoffMultiplier) {
        // Apply exponential backoff
        long nextDelay = (long) (currentDelay * backoffMultiplier);
        
        // Add jitter to prevent thundering herd
        double jitterFactor = 0.1; // 10% jitter
        long jitter = (long) (nextDelay * jitterFactor * ThreadLocalRandom.current().nextDouble());
        
        return nextDelay + jitter;
    }
    
    /**
     * Create a retry configuration for common scenarios
     */
    public static class RetryConfig {
        private final int maxRetries;
        private final long initialDelayMs;
        private final double backoffMultiplier;
        private final Predicate<Exception> shouldRetry;
        
        public RetryConfig(int maxRetries, long initialDelayMs, double backoffMultiplier) {
            this(maxRetries, initialDelayMs, backoffMultiplier, null);
        }
        
        public RetryConfig(int maxRetries, long initialDelayMs, double backoffMultiplier, 
                          Predicate<Exception> shouldRetry) {
            this.maxRetries = maxRetries;
            this.initialDelayMs = initialDelayMs;
            this.backoffMultiplier = backoffMultiplier;
            this.shouldRetry = shouldRetry;
        }
        
        // Getters
        public int getMaxRetries() { return maxRetries; }
        public long getInitialDelayMs() { return initialDelayMs; }
        public double getBackoffMultiplier() { return backoffMultiplier; }
        public Predicate<Exception> getShouldRetry() { return shouldRetry; }
        
        // Predefined configurations
        public static RetryConfig defaultConfig() {
            return new RetryConfig(3, 1000, 2.0);
        }
        
        public static RetryConfig aggressiveConfig() {
            return new RetryConfig(5, 500, 1.5);
        }
        
        public static RetryConfig conservativeConfig() {
            return new RetryConfig(2, 2000, 3.0);
        }
    }
}