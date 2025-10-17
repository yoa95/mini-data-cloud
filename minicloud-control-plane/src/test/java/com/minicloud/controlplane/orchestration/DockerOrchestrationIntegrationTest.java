package com.minicloud.controlplane.orchestration;

import com.minicloud.controlplane.service.WorkerRegistryService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration test for Docker orchestration functionality.
 * Requires Docker daemon to be running and accessible.
 */
@SpringBootTest
@ActiveProfiles("test")
@EnabledIfEnvironmentVariable(named = "DOCKER_HOST", matches = ".*")
class DockerOrchestrationIntegrationTest {
    
    private static final Logger logger = LoggerFactory.getLogger(DockerOrchestrationIntegrationTest.class);
    
    @Autowired
    private DockerOrchestrationService dockerService;
    
    @Autowired
    private ClusterAutoScaler autoScaler;
    
    @Autowired
    private LoadBalancingService loadBalancer;
    
    @Autowired
    private WorkerRegistryService workerRegistry;
    
    @Test
    void testDockerSystemInfo() {
        // Test Docker system information retrieval
        DockerSystemInfo systemInfo = dockerService.getSystemInfo();
        
        assertNotNull(systemInfo);
        assertNotNull(systemInfo.getVersion());
        assertTrue(systemInfo.getTotalContainers() >= 0);
        assertTrue(systemInfo.getRunningContainers() >= 0);
        
        logger.info("Docker system info: {}", systemInfo);
    }
    
    @Test
    void testWorkerContainerLifecycle() throws InterruptedException {
        String testWorkerId = "test-worker-" + System.currentTimeMillis();
        
        try {
            // Test container creation
            logger.info("Creating test worker container: {}", testWorkerId);
            WorkerContainer container = dockerService.createWorker(testWorkerId, Map.of(
                    "TEST_MODE", "true",
                    "LOG_LEVEL", "DEBUG"
            ));
            
            assertNotNull(container);
            assertEquals(testWorkerId, container.getWorkerId());
            assertNotNull(container.getContainerId());
            assertNotNull(container.getIpAddress());
            
            logger.info("Created container: {}", container);
            
            // Wait for container to start
            Thread.sleep(5000);
            
            // Test container status retrieval
            Optional<WorkerContainer> retrievedContainer = dockerService.getWorkerContainer(testWorkerId);
            assertTrue(retrievedContainer.isPresent());
            
            WorkerContainer statusContainer = retrievedContainer.get();
            logger.info("Container status: {}", statusContainer.getStatus());
            
            // Test health check
            ContainerHealthStatus health = dockerService.checkWorkerHealth(testWorkerId);
            assertNotNull(health);
            assertEquals(testWorkerId, health.getWorkerId());
            
            logger.info("Container health: {}", health);
            
            // Test container listing
            var containers = dockerService.listWorkerContainers();
            assertTrue(containers.stream().anyMatch(c -> c.getWorkerId().equals(testWorkerId)));
            
        } finally {
            // Clean up - remove test container
            logger.info("Cleaning up test worker container: {}", testWorkerId);
            boolean removed = dockerService.removeWorker(testWorkerId, true);
            assertTrue(removed, "Failed to remove test container");
        }
    }
    
    @Test
    void testAutoScalingConfiguration() {
        // Test auto-scaling status
        ClusterAutoScaler.AutoScalingStatus status = autoScaler.getAutoScalingStatus();
        
        assertNotNull(status);
        assertTrue(status.getMinWorkers() >= 1);
        assertTrue(status.getMaxWorkers() >= status.getMinWorkers());
        
        logger.info("Auto-scaling status: enabled={}, min={}, max={}, current={}", 
                   status.isEnabled(), status.getMinWorkers(), status.getMaxWorkers(), 
                   status.getCurrentHealthyWorkers());
        
        // Test enabling/disabling auto-scaling
        boolean originalState = status.isEnabled();
        
        autoScaler.setAutoScalingEnabled(!originalState);
        ClusterAutoScaler.AutoScalingStatus updatedStatus = autoScaler.getAutoScalingStatus();
        assertEquals(!originalState, updatedStatus.isEnabled());
        
        // Restore original state
        autoScaler.setAutoScalingEnabled(originalState);
    }
    
    @Test
    void testLoadBalancingStrategies() {
        // Test load balancing statistics
        LoadBalancingService.LoadBalancingStats stats = loadBalancer.getLoadBalancingStats();
        
        assertNotNull(stats);
        assertTrue(stats.getTotalWorkers() >= 0);
        assertTrue(stats.getHealthyWorkers() >= 0);
        assertTrue(stats.getTotalLoad() >= 0);
        
        logger.info("Load balancing stats: {}", stats);
        
        // Test different load balancing strategies
        for (LoadBalancingService.LoadBalancingStrategy strategy : LoadBalancingService.LoadBalancingStrategy.values()) {
            Optional<com.minicloud.proto.common.CommonProto.WorkerInfo> selectedWorker = 
                    loadBalancer.selectWorker(strategy);
            
            logger.info("Strategy {} selected worker: {}", 
                       strategy, selectedWorker.map(w -> w.getWorkerId()).orElse("none"));
        }
        
        // Test resetting load metrics
        loadBalancer.resetLoadMetrics();
        LoadBalancingService.LoadBalancingStats resetStats = loadBalancer.getLoadBalancingStats();
        assertEquals(0, resetStats.getTotalLoad());
    }
    
    @Test
    void testManualScaling() {
        ClusterAutoScaler.AutoScalingStatus initialStatus = autoScaler.getAutoScalingStatus();
        int initialWorkers = initialStatus.getCurrentHealthyWorkers();
        
        // Disable auto-scaling for manual test
        autoScaler.setAutoScalingEnabled(false);
        
        try {
            // Test scaling up (if within limits)
            if (initialWorkers < initialStatus.getMaxWorkers()) {
                int targetWorkers = Math.min(initialWorkers + 1, initialStatus.getMaxWorkers());
                
                logger.info("Testing manual scale up from {} to {} workers", initialWorkers, targetWorkers);
                ClusterAutoScaler.ScalingResult result = autoScaler.scaleToWorkerCount(
                        targetWorkers, "Integration test scale up");
                
                logger.info("Scale up result: success={}, message={}", result.isSuccess(), result.getMessage());
                
                // Wait for scaling to complete
                Thread.sleep(10000);
                
                // Verify scaling
                ClusterAutoScaler.AutoScalingStatus scaledStatus = autoScaler.getAutoScalingStatus();
                logger.info("After scaling: {} healthy workers", scaledStatus.getCurrentHealthyWorkers());
            }
            
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            fail("Test interrupted");
        } finally {
            // Restore auto-scaling state
            autoScaler.setAutoScalingEnabled(initialStatus.isEnabled());
        }
    }
    
    @Test
    void testContainerHealthMonitoring() throws InterruptedException {
        String testWorkerId = "health-test-worker-" + System.currentTimeMillis();
        
        try {
            // Create a test worker
            WorkerContainer container = dockerService.createWorker(testWorkerId, Map.of());
            assertNotNull(container);
            
            // Wait for container to start
            Thread.sleep(5000);
            
            // Monitor health over time
            for (int i = 0; i < 3; i++) {
                ContainerHealthStatus health = dockerService.checkWorkerHealth(testWorkerId);
                logger.info("Health check {}: {}", i + 1, health);
                
                assertNotNull(health);
                assertEquals(testWorkerId, health.getWorkerId());
                
                Thread.sleep(2000);
            }
            
        } finally {
            // Clean up
            dockerService.removeWorker(testWorkerId, true);
        }
    }
}