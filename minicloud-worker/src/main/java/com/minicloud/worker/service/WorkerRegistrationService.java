package com.minicloud.worker.service;

import com.minicloud.worker.grpc.ControlPlaneClient;
import com.minicloud.proto.common.CommonProto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.annotation.PreDestroy;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.OperatingSystemMXBean;
import java.net.InetAddress;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Service responsible for worker registration and health reporting to the control plane.
 * Handles worker lifecycle management including registration, heartbeats, and deregistration.
 */
@Service
public class WorkerRegistrationService {
    
    private static final Logger logger = LoggerFactory.getLogger(WorkerRegistrationService.class);
    
    @Value("${minicloud.worker.id:}")
    private String requestedWorkerId;
    
    @Value("${grpc.server.port:9090}")
    private int grpcPort;
    
    @Value("${server.address:localhost}")
    private String serverAddress;
    
    @Autowired
    private ControlPlaneClient controlPlaneClient;
    
    private volatile boolean registered = false;
    private volatile String assignedWorkerId;
    private final AtomicInteger activeQueries = new AtomicInteger(0);
    
    /**
     * Register worker with control plane when application is ready
     */
    @EventListener(ApplicationReadyEvent.class)
    public void registerWorker() {
        String workerId = requestedWorkerId != null && !requestedWorkerId.isEmpty() 
                ? requestedWorkerId 
                : generateDefaultWorkerId();
        
        logger.info("Registering worker {} with control plane", workerId);
        
        try {
            String endpoint = getWorkerEndpoint();
            CommonProto.ResourceInfo resources = getCurrentResourceInfo();
            Map<String, String> metadata = Map.of(
                    "version", "1.0.0",
                    "startup_time", String.valueOf(System.currentTimeMillis())
            );
            
            assignedWorkerId = controlPlaneClient.registerWorker(workerId, endpoint, resources, metadata);
            registered = true;
            
            logger.info("Worker registered successfully: {} -> {} at {}", workerId, assignedWorkerId, endpoint);
        } catch (Exception e) {
            logger.error("Failed to register worker {}", workerId, e);
            // TODO: Implement retry logic or graceful shutdown
            registered = false;
        }
    }
    
    /**
     * Send periodic health reports to control plane
     */
    @Scheduled(fixedRate = 30000) // Every 30 seconds
    public void sendHealthReport() {
        if (!registered || assignedWorkerId == null) {
            logger.debug("Worker not registered, skipping health report");
            return;
        }
        
        try {
            CommonProto.ResourceInfo resources = getCurrentResourceInfo();
            Map<String, String> statusMetadata = Map.of(
                    "active_queries", String.valueOf(activeQueries.get()),
                    "uptime_ms", String.valueOf(ManagementFactory.getRuntimeMXBean().getUptime())
            );
            
            boolean acknowledged = controlPlaneClient.sendHeartbeat(assignedWorkerId, resources, statusMetadata);
            
            if (acknowledged) {
                logger.debug("Health report sent successfully for worker {}", assignedWorkerId);
            } else {
                logger.warn("Health report not acknowledged for worker {}", assignedWorkerId);
                // If heartbeat is not acknowledged, worker might need to re-register
                registered = false;
            }
        } catch (Exception e) {
            logger.error("Failed to send health report for worker {}", assignedWorkerId, e);
            // TODO: Implement retry logic or mark worker as unhealthy
        }
    }
    
    /**
     * Deregister worker on shutdown
     */
    @PreDestroy
    public void deregisterWorker() {
        if (!registered || assignedWorkerId == null) {
            return;
        }
        
        logger.info("Deregistering worker {} from control plane", assignedWorkerId);
        
        try {
            boolean deregistered = controlPlaneClient.deregisterWorker(assignedWorkerId, "Application shutdown");
            
            if (deregistered) {
                logger.info("Worker {} deregistered successfully", assignedWorkerId);
            } else {
                logger.warn("Worker {} deregistration failed", assignedWorkerId);
            }
            
            registered = false;
        } catch (Exception e) {
            logger.error("Failed to deregister worker {}", assignedWorkerId, e);
        }
    }
    
    /**
     * Get current resource information for this worker
     */
    private CommonProto.ResourceInfo getCurrentResourceInfo() {
        OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
        MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();
        
        int cpuCores = Runtime.getRuntime().availableProcessors();
        long maxMemoryMB = memoryBean.getHeapMemoryUsage().getMax() / (1024 * 1024);
        long usedMemoryMB = memoryBean.getHeapMemoryUsage().getUsed() / (1024 * 1024);
        
        double cpuUtilization = 0.0;
        if (osBean instanceof com.sun.management.OperatingSystemMXBean) {
            cpuUtilization = ((com.sun.management.OperatingSystemMXBean) osBean).getProcessCpuLoad();
            if (cpuUtilization < 0) {
                cpuUtilization = 0.0; // Not available on some systems
            }
        }
        
        double memoryUtilization = maxMemoryMB > 0 ? (double) usedMemoryMB / maxMemoryMB : 0.0;
        
        return CommonProto.ResourceInfo.newBuilder()
                .setCpuCores(cpuCores)
                .setMemoryMb(maxMemoryMB)
                .setDiskMb(0) // TODO: Implement disk usage monitoring
                .setActiveQueries(activeQueries.get())
                .setCpuUtilization(cpuUtilization)
                .setMemoryUtilization(memoryUtilization)
                .build();
    }
    
    /**
     * Get the worker endpoint for registration
     */
    private String getWorkerEndpoint() {
        try {
            String host = serverAddress;
            if ("localhost".equals(host) || "0.0.0.0".equals(host)) {
                host = InetAddress.getLocalHost().getHostAddress();
            }
            return host + ":" + grpcPort;
        } catch (Exception e) {
            logger.warn("Failed to determine worker endpoint, using default", e);
            return "localhost:" + grpcPort;
        }
    }
    
    /**
     * Generate a default worker ID based on hostname and timestamp
     */
    private String generateDefaultWorkerId() {
        try {
            String hostname = InetAddress.getLocalHost().getHostName();
            return "worker-" + hostname + "-" + System.currentTimeMillis();
        } catch (Exception e) {
            return "worker-" + System.currentTimeMillis();
        }
    }
    
    /**
     * Increment active query count
     */
    public void incrementActiveQueries() {
        activeQueries.incrementAndGet();
    }
    
    /**
     * Decrement active query count
     */
    public void decrementActiveQueries() {
        activeQueries.decrementAndGet();
    }
    
    /**
     * Get the assigned worker ID
     */
    public String getAssignedWorkerId() {
        return assignedWorkerId;
    }
    
    /**
     * Check if worker is registered
     */
    public boolean isRegistered() {
        return registered;
    }
}