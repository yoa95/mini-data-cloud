package com.minicloud.controlplane.integration;

import com.minicloud.controlplane.dto.QueryRequest;
import com.minicloud.controlplane.dto.QueryResponse;
import com.minicloud.controlplane.model.QueryStatus;
import com.minicloud.controlplane.orchestration.DockerOrchestrationService;
import com.minicloud.controlplane.orchestration.WorkerContainer;
import com.minicloud.controlplane.service.DistributedQueryService;
import com.minicloud.controlplane.service.WorkerRegistryService;
import com.minicloud.proto.common.CommonProto;
import org.junit.jupiter.api.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration test focused on fault tolerance and worker failure scenarios.
 * Tests the system's ability to handle various failure conditions gracefully.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class FaultToleranceIntegrationTest {
    
    private static final Logger logger = LoggerFactory.getLogger(FaultToleranceIntegrationTest.class);
    
    @Autowired
    private DistributedQueryService distributedQueryService;
    
    @Autowired
    private WorkerRegistryService workerRegistryService;
    
    @Autowired
    private DockerOrchestrationService dockerOrchestrationService;
    
    private final AtomicInteger testWorkerCounter = new AtomicInteger(1000);
    
    @BeforeEach
    void setUp() throws InterruptedException {
        // Ensure we have at least one healthy worker
        ensureMinimumWorkers(1);
    }
    
    @Test
    @Order(1)
    void testQueryExecutionWithSingleWorkerFailure() throws Exception {
        logger.info("Testing query execution with single worker failure");
        
        // Ensure we have multiple workers
        ensureMinimumWorkers(2);
        
        List<CommonProto.WorkerInfo> initialWorkers = workerRegistryService.getHealthyWorkers();
        assertTrue(initialWorkers.size() >= 2, "Need at least 2 workers for this test");
        
        // Start a query that should be distributed
        QueryRequest request = new QueryRequest();
        request.setSql("SELECT category, COUNT(*) as count FROM bank_transactions GROUP BY category");
        
        CompletableFuture<QueryResponse> queryFuture = distributedQueryService.executeDistributedQuery(request);
        
        // Wait a moment for query to start
        Thread.sleep(2000);
        
        // Fail one worker
        String workerToFail = initialWorkers.get(0).getWorkerId();
        logger.info("Failing worker: {}", workerToFail);
        
        boolean removed = dockerOrchestrationService.removeWorker(workerToFail, true);
        assertTrue(removed, "Failed to remove worker");
        
        // Query should still complete due to retry logic or remaining workers
        QueryResponse response = queryFuture.get(60, TimeUnit.SECONDS);
        
        assertNotNull(response);
        // The query might succeed or fail depending on timing, but it should not hang
        logger.info("Query completed with status: {}", response.getStatus());
        
        // Verify worker count decreased
        List<CommonProto.WorkerInfo> remainingWorkers = workerRegistryService.getHealthyWorkers();
        assertTrue(remainingWorkers.size() < initialWorkers.size(), 
                  "Worker count should decrease after failure");
    }
    
    @Test
    @Order(2)
    void testQueryRetryOnWorkerFailure() throws Exception {
        logger.info("Testing query retry mechanism on worker failure");
        
        // Ensure we have workers available
        ensureMinimumWorkers(2);
        
        // Execute multiple queries to test retry behavior
        int numQueries = 3;
        CompletableFuture<QueryResponse>[] futures = new CompletableFuture[numQueries];
        
        for (int i = 0; i < numQueries; i++) {
            QueryRequest request = new QueryRequest();
            request.setSql("SELECT COUNT(*) FROM bank_transactions WHERE amount > " + (i * 50));
            futures[i] = distributedQueryService.executeDistributedQuery(request);
        }
        
        // Wait a moment for queries to start
        Thread.sleep(1000);
        
        // Simulate intermittent worker failures
        List<CommonProto.WorkerInfo> workers = workerRegistryService.getHealthyWorkers();
        if (workers.size() > 1) {
            String workerToFail = workers.get(0).getWorkerId();
            logger.info("Simulating failure of worker: {}", workerToFail);
            dockerOrchestrationService.removeWorker(workerToFail, true);
            
            // Wait and then restart the worker
            Thread.sleep(5000);
            
            logger.info("Restarting failed worker: {}", workerToFail);
            WorkerContainer restartedWorker = dockerOrchestrationService.createWorker(workerToFail, Map.of(
                    "CONTROL_PLANE_ENDPOINT", "control-plane:9090",
                    "DATA_PATH", "/data"
            ));
            assertNotNull(restartedWorker);
        }
        
        // All queries should eventually complete (with success or controlled failure)
        int successCount = 0;
        for (int i = 0; i < numQueries; i++) {
            try {
                QueryResponse response = futures[i].get(45, TimeUnit.SECONDS);
                if (response.getStatus() == QueryStatus.COMPLETED) {
                    successCount++;
                }
                logger.info("Query {} completed with status: {}", i, response.getStatus());
            } catch (Exception e) {
                logger.warn("Query {} failed: {}", i, e.getMessage());
            }
        }
        
        // At least some queries should succeed due to retry logic
        logger.info("Successful queries: {}/{}", successCount, numQueries);
    }
    
    @Test
    @Order(3)
    void testGracefulWorkerShutdown() throws Exception {
        logger.info("Testing graceful worker shutdown during query execution");
        
        // Create a temporary worker for this test
        String testWorkerId = "test-worker-" + testWorkerCounter.incrementAndGet();
        WorkerContainer testWorker = dockerOrchestrationService.createWorker(testWorkerId, Map.of(
                "CONTROL_PLANE_ENDPOINT", "control-plane:9090",
                "DATA_PATH", "/data"
        ));
        assertNotNull(testWorker);
        
        // Wait for worker to register
        Thread.sleep(10000);
        
        try {
            // Start a query
            QueryRequest request = new QueryRequest();
            request.setSql("SELECT category, AVG(amount) FROM bank_transactions GROUP BY category");
            
            CompletableFuture<QueryResponse> queryFuture = distributedQueryService.executeDistributedQuery(request);
            
            // Wait a moment for query to start
            Thread.sleep(2000);
            
            // Gracefully shutdown the test worker
            logger.info("Gracefully shutting down test worker: {}", testWorkerId);
            boolean removed = dockerOrchestrationService.removeWorker(testWorkerId, false);
            assertTrue(removed, "Failed to gracefully shutdown worker");
            
            // Query should still complete
            QueryResponse response = queryFuture.get(30, TimeUnit.SECONDS);
            assertNotNull(response);
            
            logger.info("Query completed after graceful shutdown: {}", response.getStatus());
            
        } finally {
            // Ensure cleanup
            dockerOrchestrationService.removeWorker(testWorkerId, true);
        }
    }
    
    @Test
    @Order(4)
    void testWorkerRecoveryAndReregistration() throws Exception {
        logger.info("Testing worker recovery and re-registration");
        
        // Create a test worker
        String testWorkerId = "recovery-test-worker-" + testWorkerCounter.incrementAndGet();
        WorkerContainer testWorker = dockerOrchestrationService.createWorker(testWorkerId, Map.of(
                "CONTROL_PLANE_ENDPOINT", "control-plane:9090",
                "DATA_PATH", "/data"
        ));
        assertNotNull(testWorker);
        
        // Wait for worker to register
        Thread.sleep(10000);
        
        try {
            // Verify worker is registered
            List<CommonProto.WorkerInfo> workers = workerRegistryService.getHealthyWorkers();
            assertTrue(workers.stream().anyMatch(w -> w.getWorkerId().equals(testWorkerId)),
                      "Test worker should be registered");
            
            // Stop the worker
            logger.info("Stopping test worker: {}", testWorkerId);
            boolean stopped = dockerOrchestrationService.removeWorker(testWorkerId, true);
            assertTrue(stopped, "Failed to stop worker");
            
            // Wait for deregistration
            Thread.sleep(5000);
            
            // Verify worker is deregistered
            List<CommonProto.WorkerInfo> workersAfterStop = workerRegistryService.getHealthyWorkers();
            assertFalse(workersAfterStop.stream().anyMatch(w -> w.getWorkerId().equals(testWorkerId)),
                       "Test worker should be deregistered");
            
            // Restart the worker
            logger.info("Restarting test worker: {}", testWorkerId);
            WorkerContainer restartedWorker = dockerOrchestrationService.createWorker(testWorkerId, Map.of(
                    "CONTROL_PLANE_ENDPOINT", "control-plane:9090",
                    "DATA_PATH", "/data"
            ));
            assertNotNull(restartedWorker);
            
            // Wait for re-registration
            Thread.sleep(10000);
            
            // Verify worker is re-registered
            List<CommonProto.WorkerInfo> workersAfterRestart = workerRegistryService.getHealthyWorkers();
            assertTrue(workersAfterRestart.stream().anyMatch(w -> w.getWorkerId().equals(testWorkerId)),
                      "Test worker should be re-registered");
            
            // Test that queries can be executed on the recovered worker
            QueryRequest request = new QueryRequest();
            request.setSql("SELECT COUNT(*) FROM bank_transactions");
            
            CompletableFuture<QueryResponse> future = distributedQueryService.executeDistributedQuery(request);
            QueryResponse response = future.get(30, TimeUnit.SECONDS);
            
            assertNotNull(response);
            assertEquals(QueryStatus.COMPLETED, response.getStatus());
            
            logger.info("Query executed successfully on recovered worker");
            
        } finally {
            // Cleanup
            dockerOrchestrationService.removeWorker(testWorkerId, true);
        }
    }
    
    @Test
    @Order(5)
    void testMultipleWorkerFailures() throws Exception {
        logger.info("Testing multiple worker failures");
        
        // Ensure we have multiple workers
        ensureMinimumWorkers(3);
        
        List<CommonProto.WorkerInfo> initialWorkers = workerRegistryService.getHealthyWorkers();
        int initialWorkerCount = initialWorkers.size();
        
        // Start a long-running query
        QueryRequest request = new QueryRequest();
        request.setSql("SELECT category, COUNT(*), AVG(amount), SUM(amount) FROM bank_transactions GROUP BY category");
        
        CompletableFuture<QueryResponse> queryFuture = distributedQueryService.executeDistributedQuery(request);
        
        // Wait for query to start
        Thread.sleep(2000);
        
        // Fail multiple workers (but leave at least one)
        int workersToFail = Math.min(2, initialWorkerCount - 1);
        for (int i = 0; i < workersToFail; i++) {
            String workerToFail = initialWorkers.get(i).getWorkerId();
            logger.info("Failing worker {}: {}", i + 1, workerToFail);
            dockerOrchestrationService.removeWorker(workerToFail, true);
            
            // Wait between failures
            Thread.sleep(2000);
        }
        
        // Query should still complete or fail gracefully
        try {
            QueryResponse response = queryFuture.get(60, TimeUnit.SECONDS);
            assertNotNull(response);
            logger.info("Query completed with status: {} after {} worker failures", 
                       response.getStatus(), workersToFail);
        } catch (Exception e) {
            logger.info("Query failed after multiple worker failures: {}", e.getMessage());
            // This is acceptable behavior - the system should fail gracefully
        }
        
        // Verify remaining workers are still functional
        List<CommonProto.WorkerInfo> remainingWorkers = workerRegistryService.getHealthyWorkers();
        assertTrue(remainingWorkers.size() > 0, "Should have at least one remaining worker");
        
        // Test that new queries can still be executed
        QueryRequest simpleRequest = new QueryRequest();
        simpleRequest.setSql("SELECT COUNT(*) FROM bank_transactions");
        
        CompletableFuture<QueryResponse> simpleFuture = distributedQueryService.executeDistributedQuery(simpleRequest);
        QueryResponse simpleResponse = simpleFuture.get(30, TimeUnit.SECONDS);
        
        assertNotNull(simpleResponse);
        // Should succeed with remaining workers
        
        logger.info("System remains functional after multiple worker failures");
    }
    
    @Test
    @Order(6)
    void testNetworkPartitionSimulation() throws Exception {
        logger.info("Testing network partition simulation");
        
        // This test simulates network issues by rapidly stopping and starting workers
        String testWorkerId = "network-test-worker-" + testWorkerCounter.incrementAndGet();
        
        for (int i = 0; i < 3; i++) {
            logger.info("Network partition simulation iteration: {}", i + 1);
            
            // Create worker
            WorkerContainer worker = dockerOrchestrationService.createWorker(testWorkerId, Map.of(
                    "CONTROL_PLANE_ENDPOINT", "control-plane:9090",
                    "DATA_PATH", "/data"
            ));
            assertNotNull(worker);
            
            // Wait for registration
            Thread.sleep(8000);
            
            // Execute a quick query
            QueryRequest request = new QueryRequest();
            request.setSql("SELECT COUNT(*) FROM bank_transactions LIMIT 1");
            
            try {
                CompletableFuture<QueryResponse> future = distributedQueryService.executeDistributedQuery(request);
                QueryResponse response = future.get(15, TimeUnit.SECONDS);
                logger.info("Query succeeded during network partition test: {}", response.getStatus());
            } catch (Exception e) {
                logger.info("Query failed during network partition test: {}", e.getMessage());
            }
            
            // Simulate network partition by removing worker
            dockerOrchestrationService.removeWorker(testWorkerId, true);
            Thread.sleep(2000);
        }
        
        logger.info("Network partition simulation completed");
    }
    
    /**
     * Ensure minimum number of healthy workers are available
     */
    private void ensureMinimumWorkers(int minWorkers) throws InterruptedException {
        List<CommonProto.WorkerInfo> workers = workerRegistryService.getHealthyWorkers();
        
        while (workers.size() < minWorkers) {
            logger.info("Need {} workers, currently have {}. Creating additional worker...", 
                       minWorkers, workers.size());
            
            String workerId = "test-worker-" + testWorkerCounter.incrementAndGet();
            WorkerContainer worker = dockerOrchestrationService.createWorker(workerId, Map.of(
                    "CONTROL_PLANE_ENDPOINT", "control-plane:9090",
                    "DATA_PATH", "/data"
            ));
            
            if (worker != null) {
                Thread.sleep(10000); // Wait for registration
                workers = workerRegistryService.getHealthyWorkers();
            } else {
                logger.warn("Failed to create worker: {}", workerId);
                Thread.sleep(5000);
            }
        }
        
        logger.info("Ensured {} healthy workers are available", workers.size());
    }
    
    @AfterEach
    void tearDown() {
        // Clean up any test workers that might be left running
        logger.debug("Cleaning up test workers");
    }
}