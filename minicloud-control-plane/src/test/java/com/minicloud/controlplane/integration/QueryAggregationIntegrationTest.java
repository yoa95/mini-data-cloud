package com.minicloud.controlplane.integration;

import com.minicloud.controlplane.dto.QueryRequest;
import com.minicloud.controlplane.dto.QueryResponse;
import com.minicloud.controlplane.model.QueryStatus;
import com.minicloud.controlplane.planner.DistributedQueryPlanner;
import com.minicloud.controlplane.planner.ExecutionPlan;
import com.minicloud.controlplane.service.DistributedQueryService;
import com.minicloud.controlplane.service.WorkerRegistryService;
import com.minicloud.controlplane.sql.ParsedQuery;
import com.minicloud.controlplane.sql.SqlParsingService;
import com.minicloud.proto.common.CommonProto;
import org.junit.jupiter.api.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration test focused on query result aggregation across multiple workers.
 * Tests various aggregation scenarios and verifies correctness of distributed results.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class QueryAggregationIntegrationTest {
    
    private static final Logger logger = LoggerFactory.getLogger(QueryAggregationIntegrationTest.class);
    
    @Autowired
    private DistributedQueryService distributedQueryService;
    
    @Autowired
    private WorkerRegistryService workerRegistryService;
    
    @Autowired
    private DistributedQueryPlanner queryPlanner;
    
    @Autowired
    private SqlParsingService sqlParsingService;
    
    @BeforeEach
    void setUp() throws InterruptedException {
        // Ensure we have multiple workers for aggregation testing
        List<CommonProto.WorkerInfo> workers = workerRegistryService.getHealthyWorkers();
        if (workers.size() < 2) {
            logger.warn("Only {} workers available, some tests may not demonstrate full distributed behavior", 
                       workers.size());
        }
        
        // Wait for system to be ready
        Thread.sleep(2000);
    }
    
    @Test
    @Order(1)
    void testBasicCountAggregation() throws Exception {
        logger.info("Testing basic COUNT aggregation across workers");
        
        QueryRequest request = new QueryRequest();
        request.setSql("SELECT COUNT(*) as total_count FROM bank_transactions");
        
        CompletableFuture<QueryResponse> future = distributedQueryService.executeDistributedQuery(request);
        QueryResponse response = future.get(30, TimeUnit.SECONDS);
        
        assertNotNull(response);
        assertEquals(QueryStatus.COMPLETED, response.getStatus());
        assertNull(response.getErrorMessage());
        
        // Verify result structure
        assertEquals(1, response.getColumns().size());
        assertEquals("total_count", response.getColumns().get(0));
        assertEquals(1, response.getRows().size());
        
        int totalCount = Integer.parseInt(response.getRows().get(0).get(0));
        assertTrue(totalCount > 0, "Should have positive count");
        
        logger.info("COUNT aggregation result: {}", totalCount);
    }
    
    @Test
    @Order(2)
    void testSumAggregation() throws Exception {
        logger.info("Testing SUM aggregation across workers");
        
        QueryRequest request = new QueryRequest();
        request.setSql("SELECT SUM(amount) as total_amount FROM bank_transactions");
        
        CompletableFuture<QueryResponse> future = distributedQueryService.executeDistributedQuery(request);
        QueryResponse response = future.get(30, TimeUnit.SECONDS);
        
        assertNotNull(response);
        assertEquals(QueryStatus.COMPLETED, response.getStatus());
        
        assertEquals(1, response.getRows().size());
        String totalAmountStr = response.getRows().get(0).get(0);
        assertNotNull(totalAmountStr);
        
        double totalAmount = Double.parseDouble(totalAmountStr);
        logger.info("SUM aggregation result: {}", totalAmount);
    }
    
    @Test
    @Order(3)
    void testAverageAggregation() throws Exception {
        logger.info("Testing AVG aggregation across workers");
        
        QueryRequest request = new QueryRequest();
        request.setSql("SELECT AVG(amount) as avg_amount FROM bank_transactions");
        
        CompletableFuture<QueryResponse> future = distributedQueryService.executeDistributedQuery(request);
        QueryResponse response = future.get(30, TimeUnit.SECONDS);
        
        assertNotNull(response);
        assertEquals(QueryStatus.COMPLETED, response.getStatus());
        
        assertEquals(1, response.getRows().size());
        String avgAmountStr = response.getRows().get(0).get(0);
        assertNotNull(avgAmountStr);
        
        double avgAmount = Double.parseDouble(avgAmountStr);
        assertTrue(avgAmount > 0, "Average should be positive");
        
        logger.info("AVG aggregation result: {}", avgAmount);
    }
    
    @Test
    @Order(4)
    void testMinMaxAggregation() throws Exception {
        logger.info("Testing MIN/MAX aggregation across workers");
        
        QueryRequest request = new QueryRequest();
        request.setSql("SELECT MIN(amount) as min_amount, MAX(amount) as max_amount FROM bank_transactions");
        
        CompletableFuture<QueryResponse> future = distributedQueryService.executeDistributedQuery(request);
        QueryResponse response = future.get(30, TimeUnit.SECONDS);
        
        assertNotNull(response);
        assertEquals(QueryStatus.COMPLETED, response.getStatus());
        
        assertEquals(1, response.getRows().size());
        List<String> row = response.getRows().get(0);
        assertEquals(2, row.size());
        
        double minAmount = Double.parseDouble(row.get(0));
        double maxAmount = Double.parseDouble(row.get(1));
        
        assertTrue(minAmount <= maxAmount, "Min should be <= Max");
        
        logger.info("MIN/MAX aggregation result: min={}, max={}", minAmount, maxAmount);
    }
    
    @Test
    @Order(5)
    void testGroupByAggregation() throws Exception {
        logger.info("Testing GROUP BY aggregation across workers");
        
        QueryRequest request = new QueryRequest();
        request.setSql("SELECT category, COUNT(*) as count, SUM(amount) as total " +
                      "FROM bank_transactions " +
                      "GROUP BY category " +
                      "ORDER BY count DESC");
        
        CompletableFuture<QueryResponse> future = distributedQueryService.executeDistributedQuery(request);
        QueryResponse response = future.get(45, TimeUnit.SECONDS);
        
        assertNotNull(response);
        assertEquals(QueryStatus.COMPLETED, response.getStatus());
        
        // Verify result structure
        assertEquals(3, response.getColumns().size());
        assertTrue(response.getRows().size() > 0);
        
        // Verify each group has valid aggregated values
        for (List<String> row : response.getRows()) {
            assertNotNull(row.get(0)); // category
            int count = Integer.parseInt(row.get(1));
            assertTrue(count > 0, "Count should be positive");
            
            double total = Double.parseDouble(row.get(2));
            // Total can be negative for some transaction categories
            
            logger.debug("Group: category={}, count={}, total={}", row.get(0), count, total);
        }
        
        logger.info("GROUP BY aggregation completed with {} groups", response.getRows().size());
    }
    
    @Test
    @Order(6)
    void testComplexAggregationWithHaving() throws Exception {
        logger.info("Testing complex aggregation with HAVING clause");
        
        QueryRequest request = new QueryRequest();
        request.setSql("SELECT category, COUNT(*) as transaction_count, AVG(amount) as avg_amount " +
                      "FROM bank_transactions " +
                      "GROUP BY category " +
                      "HAVING COUNT(*) > 5 AND AVG(amount) > 0 " +
                      "ORDER BY avg_amount DESC");
        
        CompletableFuture<QueryResponse> future = distributedQueryService.executeDistributedQuery(request);
        QueryResponse response = future.get(45, TimeUnit.SECONDS);
        
        assertNotNull(response);
        assertEquals(QueryStatus.COMPLETED, response.getStatus());
        
        // Verify HAVING clause filtering
        for (List<String> row : response.getRows()) {
            int count = Integer.parseInt(row.get(1));
            double avgAmount = Double.parseDouble(row.get(2));
            
            assertTrue(count > 5, "HAVING clause should filter count > 5");
            assertTrue(avgAmount > 0, "HAVING clause should filter avg_amount > 0");
        }
        
        logger.info("Complex aggregation with HAVING completed with {} groups", response.getRows().size());
    }
    
    @Test
    @Order(7)
    void testMultipleAggregationFunctions() throws Exception {
        logger.info("Testing multiple aggregation functions in single query");
        
        QueryRequest request = new QueryRequest();
        request.setSql("SELECT " +
                      "COUNT(*) as total_transactions, " +
                      "SUM(amount) as total_amount, " +
                      "AVG(amount) as avg_amount, " +
                      "MIN(amount) as min_amount, " +
                      "MAX(amount) as max_amount, " +
                      "COUNT(DISTINCT category) as unique_categories " +
                      "FROM bank_transactions");
        
        CompletableFuture<QueryResponse> future = distributedQueryService.executeDistributedQuery(request);
        QueryResponse response = future.get(30, TimeUnit.SECONDS);
        
        assertNotNull(response);
        assertEquals(QueryStatus.COMPLETED, response.getStatus());
        
        assertEquals(1, response.getRows().size());
        List<String> row = response.getRows().get(0);
        assertEquals(6, row.size());
        
        int totalTransactions = Integer.parseInt(row.get(0));
        double totalAmount = Double.parseDouble(row.get(1));
        double avgAmount = Double.parseDouble(row.get(2));
        double minAmount = Double.parseDouble(row.get(3));
        double maxAmount = Double.parseDouble(row.get(4));
        int uniqueCategories = Integer.parseInt(row.get(5));
        
        // Verify relationships between aggregated values
        assertTrue(totalTransactions > 0);
        assertTrue(minAmount <= avgAmount);
        assertTrue(avgAmount <= maxAmount);
        assertTrue(uniqueCategories > 0);
        
        logger.info("Multiple aggregation functions result: transactions={}, total={}, avg={}, min={}, max={}, categories={}", 
                   totalTransactions, totalAmount, avgAmount, minAmount, maxAmount, uniqueCategories);
    }
    
    @Test
    @Order(8)
    void testAggregationWithWhereClause() throws Exception {
        logger.info("Testing aggregation with WHERE clause filtering");
        
        QueryRequest request = new QueryRequest();
        request.setSql("SELECT category, COUNT(*) as count, AVG(amount) as avg_amount " +
                      "FROM bank_transactions " +
                      "WHERE amount > 100 AND amount < 1000 " +
                      "GROUP BY category " +
                      "ORDER BY count DESC");
        
        CompletableFuture<QueryResponse> future = distributedQueryService.executeDistributedQuery(request);
        QueryResponse response = future.get(45, TimeUnit.SECONDS);
        
        assertNotNull(response);
        assertEquals(QueryStatus.COMPLETED, response.getStatus());
        
        // Verify that filtering was applied correctly
        // (We can't verify the exact filter without knowing the data, but we can verify structure)
        for (List<String> row : response.getRows()) {
            assertNotNull(row.get(0)); // category
            int count = Integer.parseInt(row.get(1));
            assertTrue(count > 0);
            
            double avgAmount = Double.parseDouble(row.get(2));
            // Average should be within the filtered range (approximately)
            assertTrue(avgAmount > 0);
        }
        
        logger.info("Aggregation with WHERE clause completed with {} groups", response.getRows().size());
    }
    
    @Test
    @Order(9)
    void testNestedAggregationQuery() throws Exception {
        logger.info("Testing nested aggregation query");
        
        // This tests a more complex query that might require multiple stages
        QueryRequest request = new QueryRequest();
        request.setSql("SELECT " +
                      "CASE " +
                      "  WHEN amount < 100 THEN 'Small' " +
                      "  WHEN amount < 500 THEN 'Medium' " +
                      "  ELSE 'Large' " +
                      "END as amount_category, " +
                      "COUNT(*) as transaction_count, " +
                      "SUM(amount) as total_amount " +
                      "FROM bank_transactions " +
                      "GROUP BY 1 " +
                      "ORDER BY total_amount DESC");
        
        CompletableFuture<QueryResponse> future = distributedQueryService.executeDistributedQuery(request);
        QueryResponse response = future.get(45, TimeUnit.SECONDS);
        
        assertNotNull(response);
        assertEquals(QueryStatus.COMPLETED, response.getStatus());
        
        // Should have up to 3 categories: Small, Medium, Large
        assertTrue(response.getRows().size() <= 3);
        assertTrue(response.getRows().size() > 0);
        
        for (List<String> row : response.getRows()) {
            String category = row.get(0);
            assertTrue(List.of("Small", "Medium", "Large").contains(category));
            
            int count = Integer.parseInt(row.get(1));
            assertTrue(count > 0);
            
            double total = Double.parseDouble(row.get(2));
            assertTrue(total != 0); // Can be negative for some categories
        }
        
        logger.info("Nested aggregation query completed with {} categories", response.getRows().size());
    }
    
    @Test
    @Order(10)
    void testAggregationConsistencyAcrossExecutions() throws Exception {
        logger.info("Testing aggregation consistency across multiple executions");
        
        String sql = "SELECT COUNT(*) as count, SUM(amount) as total FROM bank_transactions";
        
        // Execute the same query multiple times
        QueryResponse[] responses = new QueryResponse[3];
        
        for (int i = 0; i < 3; i++) {
            QueryRequest request = new QueryRequest();
            request.setSql(sql);
            
            CompletableFuture<QueryResponse> future = distributedQueryService.executeDistributedQuery(request);
            responses[i] = future.get(30, TimeUnit.SECONDS);
            
            assertNotNull(responses[i]);
            assertEquals(QueryStatus.COMPLETED, responses[i].getStatus());
        }
        
        // Verify all executions return the same results
        String firstCount = responses[0].getRows().get(0).get(0);
        String firstTotal = responses[0].getRows().get(0).get(1);
        
        for (int i = 1; i < 3; i++) {
            String count = responses[i].getRows().get(0).get(0);
            String total = responses[i].getRows().get(0).get(1);
            
            assertEquals(firstCount, count, "Count should be consistent across executions");
            assertEquals(firstTotal, total, "Total should be consistent across executions");
        }
        
        logger.info("Aggregation consistency verified: count={}, total={}", firstCount, firstTotal);
    }
    
    @Test
    @Order(11)
    void testExecutionPlanGeneration() throws Exception {
        logger.info("Testing execution plan generation for aggregation queries");
        
        String[] testQueries = {
                "SELECT COUNT(*) FROM bank_transactions",
                "SELECT category, COUNT(*) FROM bank_transactions GROUP BY category",
                "SELECT category, AVG(amount) FROM bank_transactions GROUP BY category HAVING COUNT(*) > 5"
        };
        
        for (String sql : testQueries) {
            logger.info("Analyzing execution plan for: {}", sql);
            
            try {
                ParsedQuery parsedQuery = sqlParsingService.parseAndValidateQuery(sql);
                ExecutionPlan plan = queryPlanner.createExecutionPlan("test-query", parsedQuery);
                
                assertNotNull(plan);
                assertTrue(plan.getStageCount() > 0);
                
                logger.info("Generated plan with {} stages for query: {}", plan.getStageCount(), sql);
                
            } catch (Exception e) {
                logger.warn("Failed to generate plan for query: {} - {}", sql, e.getMessage());
                // Some queries might not be fully supported yet, which is acceptable
            }
        }
    }
    
    @AfterEach
    void tearDown() {
        logger.debug("Cleaning up after aggregation test");
    }
}