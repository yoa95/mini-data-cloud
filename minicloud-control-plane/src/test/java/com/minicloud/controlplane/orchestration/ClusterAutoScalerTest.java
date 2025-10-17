package com.minicloud.controlplane.orchestration;

import com.minicloud.controlplane.service.WorkerRegistryService;
import com.minicloud.controlplane.planner.QueryScheduler;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for ClusterAutoScaler functionality
 */
@ExtendWith(MockitoExtension.class)
class ClusterAutoScalerTest {
    
    @Mock
    private DockerOrchestrationService dockerService;
    
    @Mock
    private WorkerRegistryService workerRegistryService;
    
    @Mock
    private QueryScheduler queryScheduler;
    
    private ClusterAutoScaler autoScaler;
    
    @BeforeEach
    void setUp() {
        autoScaler = new ClusterAutoScaler();
        
        // Inject mocked dependencies
        ReflectionTestUtils.setField(autoScaler, "dockerService", dockerService);
        ReflectionTestUtils.setField(autoScaler, "workerRegistryService", workerRegistryService);
        ReflectionTestUtils.setField(autoScaler, "queryScheduler", queryScheduler);
        
        // Set configuration values
        ReflectionTestUtils.setField(autoScaler, "autoScalingEnabled", true);
        ReflectionTestUtils.setField(autoScaler, "minWorkers", 1);
        ReflectionTestUtils.setField(autoScaler, "maxWorkers", 5);
        ReflectionTestUtils.setField(autoScaler, "scaleUpThreshold", 0.8);
        ReflectionTestUtils.setField(autoScaler, "scaleDownThreshold", 0.3);
        ReflectionTestUtils.setField(autoScaler, "cooldownMinutes", 2);
    }
    
    @Test
    void testAutoScalingStatus() {
        // Mock worker registry responses
        List<CommonProto.WorkerInfo> allWorkers = Arrays.asList(
                createMockWorkerInfo("worker-1", 50.0, 40.0, 2),
                createMockWorkerInfo("worker-2", 60.0, 50.0, 1)
        );
        List<CommonProto.WorkerInfo> healthyWorkers = allWorkers;
        
        when(workerRegistryService.getWorkers(null)).thenReturn(allWorkers);
        when(workerRegistryService.getHealthyWorkers()).thenReturn(healthyWorkers);
        when(queryScheduler.getActiveQueries()).thenReturn(Collections.emptyList());
        
        // Test auto-scaling status
        ClusterAutoScaler.AutoScalingStatus status = autoScaler.getAutoScalingStatus();
        
        assertNotNull(status);
        assertTrue(status.isEnabled());
        assertEquals(1, status.getMinWorkers());
        assertEquals(5, status.getMaxWorkers());
        assertEquals(2, status.getCurrentHealthyWorkers());
        assertEquals(2, status.getCurrentTotalWorkers());
    }
    
    @Test
    void testManualScalingWithinLimits() {
        // Mock current state
        List<CommonProto.WorkerInfo> currentWorkers = Arrays.asList(
                createMockWorkerInfo("worker-1", 30.0, 25.0, 1)
        );
        
        when(workerRegistryService.getWorkers(null)).thenReturn(currentWorkers);
        when(workerRegistryService.getHealthyWorkers()).thenReturn(currentWorkers);
        when(queryScheduler.getActiveQueries()).thenReturn(Collections.emptyList());
        
        // Mock Docker service for scaling up
        WorkerContainer newContainer = new WorkerContainer(
                "auto-worker-1", "container-123", "minicloud-worker-auto-worker-1",
                "172.18.0.3", ContainerStatus.RUNNING, System.currentTimeMillis()
        );
        when(dockerService.createWorker(anyString(), any())).thenReturn(newContainer);
        
        // Test scaling up
        ClusterAutoScaler.ScalingResult result = autoScaler.scaleToWorkerCount(2, "Test scale up");
        
        assertTrue(result.isSuccess());
        assertEquals(1, result.getPreviousWorkerCount());
        assertEquals(2, result.getNewWorkerCount());
        
        verify(dockerService, times(1)).createWorker(anyString(), any());
    }
    
    @Test
    void testManualScalingOutsideLimits() {
        // Test scaling beyond maximum
        ClusterAutoScaler.ScalingResult result = autoScaler.scaleToWorkerCount(10, "Test invalid scale");
        
        assertFalse(result.isSuccess());
        assertTrue(result.getMessage().contains("outside allowed range"));
        
        // Test scaling below minimum
        result = autoScaler.scaleToWorkerCount(0, "Test invalid scale");
        
        assertFalse(result.isSuccess());
        assertTrue(result.getMessage().contains("outside allowed range"));
    }
    
    @Test
    void testScaleDownSelection() {
        // Mock workers with different loads
        List<CommonProto.WorkerInfo> workers = Arrays.asList(
                createMockWorkerInfo("worker-1", 20.0, 15.0, 0), // Least loaded
                createMockWorkerInfo("worker-2", 40.0, 30.0, 2), // Most loaded
                createMockWorkerInfo("worker-3", 30.0, 25.0, 1)  // Medium loaded
        );
        
        when(workerRegistryService.getWorkers(null)).thenReturn(workers);
        when(workerRegistryService.getHealthyWorkers()).thenReturn(workers);
        when(queryScheduler.getActiveQueries()).thenReturn(Collections.emptyList());
        when(dockerService.removeWorker(anyString(), anyBoolean())).thenReturn(true);
        
        // Test scaling down - should remove least loaded worker first
        ClusterAutoScaler.ScalingResult result = autoScaler.scaleToWorkerCount(2, "Test scale down");
        
        assertTrue(result.isSuccess());
        verify(dockerService).removeWorker("worker-1", false); // Least loaded worker should be removed
    }
    
    @Test
    void testEnableDisableAutoScaling() {
        // Mock minimum workers scenario
        when(workerRegistryService.getWorkers(null)).thenReturn(Collections.emptyList());
        when(workerRegistryService.getHealthyWorkers()).thenReturn(Collections.emptyList());
        when(queryScheduler.getActiveQueries()).thenReturn(Collections.emptyList());
        
        WorkerContainer mockContainer = new WorkerContainer(
                "auto-worker-1", "container-123", "minicloud-worker-auto-worker-1",
                "172.18.0.3", ContainerStatus.RUNNING, System.currentTimeMillis()
        );
        when(dockerService.createWorker(anyString(), any())).thenReturn(mockContainer);
        
        // Test initial state
        ClusterAutoScaler.AutoScalingStatus status = autoScaler.getAutoScalingStatus();
        assertTrue(status.isEnabled());
        
        // Test disabling
        autoScaler.setAutoScalingEnabled(false);
        status = autoScaler.getAutoScalingStatus();
        assertFalse(status.isEnabled());
        
        // Test re-enabling (this will trigger ensureMinimumWorkers)
        autoScaler.setAutoScalingEnabled(true);
        status = autoScaler.getAutoScalingStatus();
        assertTrue(status.isEnabled());
    }
    
    @Test
    void testScalingDecisionLogic() {
        // This test would require access to private methods or refactoring to make them testable
        // For now, we test the public interface behavior
        
        // Mock high load scenario
        List<CommonProto.WorkerInfo> highLoadWorkers = Arrays.asList(
                createMockWorkerInfo("worker-1", 90.0, 85.0, 5) // High CPU and memory usage
        );
        
        when(workerRegistryService.getWorkers(null)).thenReturn(highLoadWorkers);
        when(workerRegistryService.getHealthyWorkers()).thenReturn(highLoadWorkers);
        when(queryScheduler.getActiveQueries()).thenReturn(Collections.emptyList());
        
        ClusterAutoScaler.AutoScalingStatus status = autoScaler.getAutoScalingStatus();
        
        // Verify that the system recognizes the high load condition
        assertNotNull(status);
        assertEquals(1, status.getCurrentHealthyWorkers());
        
        // In a real scenario, the auto-scaler would trigger scale-up
        // but testing the periodic method requires more complex setup
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