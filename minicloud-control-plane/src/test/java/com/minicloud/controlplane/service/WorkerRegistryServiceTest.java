package com.minicloud.controlplane.service;

import com.minicloud.proto.common.CommonProto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for WorkerRegistryService
 */
class WorkerRegistryServiceTest {
    
    private WorkerRegistryService workerRegistryService;
    
    @BeforeEach
    void setUp() {
        workerRegistryService = new WorkerRegistryService();
    }
    
    @Test
    void testWorkerRegistration() {
        // Given
        String requestedWorkerId = "test-worker-1";
        String endpoint = "localhost:9091";
        CommonProto.ResourceInfo resources = CommonProto.ResourceInfo.newBuilder()
                .setCpuCores(4)
                .setMemoryMb(8192)
                .setActiveQueries(0)
                .setCpuUtilization(0.1)
                .setMemoryUtilization(0.2)
                .build();
        Map<String, String> metadata = Map.of("version", "1.0.0");
        
        // When
        String assignedWorkerId = workerRegistryService.registerWorker(requestedWorkerId, endpoint, resources, metadata);
        
        // Then
        assertEquals(requestedWorkerId, assignedWorkerId);
        assertTrue(workerRegistryService.isWorkerHealthy(assignedWorkerId));
        
        CommonProto.WorkerInfo workerInfo = workerRegistryService.getWorker(assignedWorkerId);
        assertNotNull(workerInfo);
        assertEquals(assignedWorkerId, workerInfo.getWorkerId());
        assertEquals(endpoint, workerInfo.getEndpoint());
        assertEquals(CommonProto.WorkerStatus.HEALTHY, workerInfo.getStatus());
    }
    
    @Test
    void testWorkerDeregistration() {
        // Given
        String workerId = workerRegistryService.registerWorker("test-worker", "localhost:9091", 
                CommonProto.ResourceInfo.getDefaultInstance(), Map.of());
        
        // When
        boolean deregistered = workerRegistryService.deregisterWorker(workerId, "Test shutdown");
        
        // Then
        assertTrue(deregistered);
        assertFalse(workerRegistryService.isWorkerHealthy(workerId));
        assertNull(workerRegistryService.getWorker(workerId));
    }
    
    @Test
    void testHeartbeatUpdate() {
        // Given
        String workerId = workerRegistryService.registerWorker("test-worker", "localhost:9091", 
                CommonProto.ResourceInfo.getDefaultInstance(), Map.of());
        
        CommonProto.ResourceInfo updatedResources = CommonProto.ResourceInfo.newBuilder()
                .setCpuCores(8)
                .setMemoryMb(16384)
                .setActiveQueries(2)
                .setCpuUtilization(0.5)
                .setMemoryUtilization(0.6)
                .build();
        
        // When
        boolean updated = workerRegistryService.updateWorkerHeartbeat(workerId, updatedResources, 
                Map.of("active_queries", "2"));
        
        // Then
        assertTrue(updated);
        
        CommonProto.WorkerInfo workerInfo = workerRegistryService.getWorker(workerId);
        assertNotNull(workerInfo);
        assertEquals(8, workerInfo.getResources().getCpuCores());
        assertEquals(16384, workerInfo.getResources().getMemoryMb());
        assertEquals(2, workerInfo.getResources().getActiveQueries());
    }
    
    @Test
    void testGetHealthyWorkers() {
        // Given
        workerRegistryService.registerWorker("worker-1", "localhost:9091", 
                CommonProto.ResourceInfo.getDefaultInstance(), Map.of());
        workerRegistryService.registerWorker("worker-2", "localhost:9092", 
                CommonProto.ResourceInfo.getDefaultInstance(), Map.of());
        
        // When
        List<CommonProto.WorkerInfo> healthyWorkers = workerRegistryService.getHealthyWorkers();
        
        // Then
        assertEquals(2, healthyWorkers.size());
        assertTrue(healthyWorkers.stream().allMatch(w -> w.getStatus() == CommonProto.WorkerStatus.HEALTHY));
    }
    
    @Test
    void testClusterStats() {
        // Given
        workerRegistryService.registerWorker("worker-1", "localhost:9091", 
                CommonProto.ResourceInfo.getDefaultInstance(), Map.of());
        workerRegistryService.registerWorker("worker-2", "localhost:9092", 
                CommonProto.ResourceInfo.getDefaultInstance(), Map.of());
        
        // When
        WorkerRegistryService.ClusterStats stats = workerRegistryService.getClusterStats();
        
        // Then
        assertEquals(2, stats.getTotalWorkers());
        assertEquals(2, stats.getHealthyWorkers());
        assertEquals(0, stats.getUnhealthyWorkers());
        assertEquals(0, stats.getDrainingWorkers());
    }
    
    @Test
    void testUniqueWorkerIdGeneration() {
        // Given
        String requestedId = "duplicate-worker";
        
        // When
        String workerId1 = workerRegistryService.registerWorker(requestedId, "localhost:9091", 
                CommonProto.ResourceInfo.getDefaultInstance(), Map.of());
        String workerId2 = workerRegistryService.registerWorker(requestedId, "localhost:9092", 
                CommonProto.ResourceInfo.getDefaultInstance(), Map.of());
        
        // Then
        assertEquals(requestedId, workerId1);
        assertNotEquals(requestedId, workerId2);
        assertTrue(workerId2.startsWith(requestedId + "-"));
    }
}