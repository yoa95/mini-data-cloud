package com.minicloud.controlplane.orchestration;

import com.minicloud.controlplane.service.WorkerRegistryService;
import com.minicloud.proto.common.CommonProto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for LoadBalancingService functionality
 */
@ExtendWith(MockitoExtension.class)
class LoadBalancingServiceTest {
    
    @Mock
    private WorkerRegistryService workerRegistryService;
    
    @Mock
    private DockerOrchestrationService dockerService;
    
    private LoadBalancingService loadBalancingService;
    
    @BeforeEach
    void setUp() {
        loadBalancingService = new LoadBalancingService();
        
        // Inject mocked dependencies
        ReflectionTestUtils.setField(loadBalancingService, "workerRegistryService", workerRegistryService);
        ReflectionTestUtils.setField(loadBalancingService, "dockerService", dockerService);
    }
    
    @Test
    void testRoundRobinSelection() {
        // Mock available workers
        List<CommonProto.WorkerInfo> workers = Arrays.asList(
                createMockWorkerInfo("worker-1", 30.0, 25.0, 1),
                createMockWorkerInfo("worker-2", 40.0, 35.0, 2),
                createMockWorkerInfo("worker-3", 50.0, 45.0, 1)
        );
        
        when(workerRegistryService.getHealthyWorkers()).thenReturn(workers);
        when(dockerService.getWorkerContainer(anyString())).thenReturn(Optional.of(
                new WorkerContainer("test", "container-id", "name", "ip", ContainerStatus.RUNNING, 0L)
        ));
        
        // Test round-robin selection
        Optional<CommonProto.WorkerInfo> worker1 = loadBalancingService.selectWorker(
                LoadBalancingService.LoadBalancingStrategy.ROUND_ROBIN);
        Optional<CommonProto.WorkerInfo> worker2 = loadBalancingService.selectWorker(
                LoadBalancingService.LoadBalancingStrategy.ROUND_ROBIN);
        Optional<CommonProto.WorkerInfo> worker3 = loadBalancingService.selectWorker(
                LoadBalancingService.LoadBalancingStrategy.ROUND_ROBIN);
        Optional<CommonProto.WorkerInfo> worker4 = loadBalancingService.selectWorker(
                LoadBalancingService.LoadBalancingStrategy.ROUND_ROBIN);
        
        assertTrue(worker1.isPresent());
        assertTrue(worker2.isPresent());
        assertTrue(worker3.isPresent());
        assertTrue(worker4.isPresent());
        
        // Should cycle through workers
        assertEquals("worker-1", worker1.get().getWorkerId());
        assertEquals("worker-2", worker2.get().getWorkerId());
        assertEquals("worker-3", worker3.get().getWorkerId());
        assertEquals("worker-1", worker4.get().getWorkerId()); // Back to first
    }
    
    @Test
    void testLeastConnectionsSelection() {
        // Mock workers with different connection counts
        List<CommonProto.WorkerInfo> workers = Arrays.asList(
                createMockWorkerInfo("worker-1", 30.0, 25.0, 3), // Most connections
                createMockWorkerInfo("worker-2", 40.0, 35.0, 1), // Least connections
                createMockWorkerInfo("worker-3", 50.0, 45.0, 2)  // Medium connections
        );
        
        when(workerRegistryService.getHealthyWorkers()).thenReturn(workers);
        when(dockerService.getWorkerContainer(anyString())).thenReturn(Optional.of(
                new WorkerContainer("test", "container-id", "name", "ip", ContainerStatus.RUNNING, 0L)
        ));
        
        // Test least connections selection
        Optional<CommonProto.WorkerInfo> selectedWorker = loadBalancingService.selectWorker(
                LoadBalancingService.LoadBalancingStrategy.LEAST_CONNECTIONS);
        
        assertTrue(selectedWorker.isPresent());
        assertEquals("worker-2", selectedWorker.get().getWorkerId()); // Should select worker with least connections
    }
    
    @Test
    void testResourceAwareSelection() {
        // Mock workers with different resource usage
        List<CommonProto.WorkerInfo> workers = Arrays.asList(
                createMockWorkerInfo("worker-1", 80.0, 75.0, 2), // High resource usage
                createMockWorkerInfo("worker-2", 20.0, 15.0, 1), // Low resource usage (best choice)
                createMockWorkerInfo("worker-3", 60.0, 55.0, 1)  // Medium resource usage
        );
        
        when(workerRegistryService.getHealthyWorkers()).thenReturn(workers);
        when(dockerService.getWorkerContainer(anyString())).thenReturn(Optional.of(
                new WorkerContainer("test", "container-id", "name", "ip", ContainerStatus.RUNNING, 0L)
        ));
        
        // Test resource-aware selection
        Optional<CommonProto.WorkerInfo> selectedWorker = loadBalancingService.selectWorker(
                LoadBalancingService.LoadBalancingStrategy.RESOURCE_AWARE);
        
        assertTrue(selectedWorker.isPresent());
        assertEquals("worker-2", selectedWorker.get().getWorkerId()); // Should select worker with most available resources
    }
    
    @Test
    void testMultipleWorkerSelection() {
        // Mock available workers
        List<CommonProto.WorkerInfo> workers = Arrays.asList(
                createMockWorkerInfo("worker-1", 30.0, 25.0, 1),
                createMockWorkerInfo("worker-2", 40.0, 35.0, 2),
                createMockWorkerInfo("worker-3", 50.0, 45.0, 1),
                createMockWorkerInfo("worker-4", 20.0, 15.0, 0)
        );
        
        when(workerRegistryService.getHealthyWorkers()).thenReturn(workers);
        when(dockerService.getWorkerContainer(anyString())).thenReturn(Optional.of(
                new WorkerContainer("test", "container-id", "name", "ip", ContainerStatus.RUNNING, 0L)
        ));
        
        // Test selecting multiple workers
        List<CommonProto.WorkerInfo> selectedWorkers = loadBalancingService.selectWorkers(
                3, LoadBalancingService.LoadBalancingStrategy.LEAST_CONNECTIONS);
        
        assertEquals(3, selectedWorkers.size());
        
        // Should be sorted by least connections: worker-4 (0), worker-1 (1), worker-3 (1)
        assertEquals("worker-4", selectedWorkers.get(0).getWorkerId());
        assertTrue(selectedWorkers.get(1).getWorkerId().equals("worker-1") || 
                  selectedWorkers.get(1).getWorkerId().equals("worker-3"));
    }
    
    @Test
    void testNoAvailableWorkers() {
        // Mock no available workers
        when(workerRegistryService.getHealthyWorkers()).thenReturn(Collections.emptyList());
        
        // Test selection with no workers
        Optional<CommonProto.WorkerInfo> selectedWorker = loadBalancingService.selectWorker(
                LoadBalancingService.LoadBalancingStrategy.ROUND_ROBIN);
        
        assertFalse(selectedWorker.isPresent());
        
        // Test multiple selection with no workers
        List<CommonProto.WorkerInfo> selectedWorkers = loadBalancingService.selectWorkers(
                3, LoadBalancingService.LoadBalancingStrategy.LEAST_LOADED);
        
        assertTrue(selectedWorkers.isEmpty());
    }
    
    @Test
    void testLoadMetricsTracking() {
        // Mock available workers
        List<CommonProto.WorkerInfo> workers = Arrays.asList(
                createMockWorkerInfo("worker-1", 30.0, 25.0, 1)
        );
        
        when(workerRegistryService.getHealthyWorkers()).thenReturn(workers);
        when(workerRegistryService.getWorkers(null)).thenReturn(workers);
        when(dockerService.getWorkerContainer(anyString())).thenReturn(Optional.of(
                new WorkerContainer("test", "container-id", "name", "ip", ContainerStatus.RUNNING, 0L)
        ));
        
        // Initial stats should show no load
        LoadBalancingService.LoadBalancingStats initialStats = loadBalancingService.getLoadBalancingStats();
        assertEquals(0, initialStats.getTotalLoad());
        
        // Select a worker (should increase load)
        Optional<CommonProto.WorkerInfo> selectedWorker = loadBalancingService.selectWorker(
                LoadBalancingService.LoadBalancingStrategy.ROUND_ROBIN);
        assertTrue(selectedWorker.isPresent());
        
        // Stats should now show increased load
        LoadBalancingService.LoadBalancingStats updatedStats = loadBalancingService.getLoadBalancingStats();
        assertEquals(1, updatedStats.getTotalLoad());
        assertEquals(1.0, updatedStats.getAverageLoad(), 0.01);
        
        // Release load
        loadBalancingService.releaseWorkerLoad("worker-1", 1);
        
        // Stats should show reduced load
        LoadBalancingService.LoadBalancingStats finalStats = loadBalancingService.getLoadBalancingStats();
        assertEquals(0, finalStats.getTotalLoad());
    }
    
    @Test
    void testLoadMetricsReset() {
        // Mock available workers
        List<CommonProto.WorkerInfo> workers = Arrays.asList(
                createMockWorkerInfo("worker-1", 30.0, 25.0, 1)
        );
        
        when(workerRegistryService.getHealthyWorkers()).thenReturn(workers);
        when(workerRegistryService.getWorkers(null)).thenReturn(workers);
        when(dockerService.getWorkerContainer(anyString())).thenReturn(Optional.of(
                new WorkerContainer("test", "container-id", "name", "ip", ContainerStatus.RUNNING, 0L)
        ));
        
        // Add some load
        loadBalancingService.selectWorker(LoadBalancingService.LoadBalancingStrategy.ROUND_ROBIN);
        loadBalancingService.selectWorker(LoadBalancingService.LoadBalancingStrategy.ROUND_ROBIN);
        
        LoadBalancingService.LoadBalancingStats beforeReset = loadBalancingService.getLoadBalancingStats();
        assertEquals(2, beforeReset.getTotalLoad());
        
        // Reset metrics
        loadBalancingService.resetLoadMetrics();
        
        LoadBalancingService.LoadBalancingStats afterReset = loadBalancingService.getLoadBalancingStats();
        assertEquals(0, afterReset.getTotalLoad());
    }
    
    private CommonProto.WorkerInfo createMockWorkerInfo(String workerId, double cpuUsage, 
                                                       double memoryUsage, int activeQueries) {
        return CommonProto.WorkerInfo.newBuilder()
                .setWorkerId(workerId)
                .setEndpoint(workerId + ":9091")
                .setStatus(CommonProto.WorkerStatus.HEALTHY)
                .setResources(CommonProto.ResourceInfo.newBuilder()
                        .setCpuUtilization(cpuUsage / 100.0)
                        .setMemoryUtilization(memoryUsage / 100.0)
                        .setActiveQueries(activeQueries)
                        .build())
                .build();
    }
}