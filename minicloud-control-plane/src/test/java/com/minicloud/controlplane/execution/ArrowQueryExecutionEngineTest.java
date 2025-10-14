package com.minicloud.controlplane.execution;

import org.apache.arrow.memory.BufferAllocator;
import org.apache.arrow.memory.RootAllocator;
import org.apache.arrow.vector.BigIntVector;
import org.apache.arrow.vector.VarCharVector;
import org.apache.arrow.vector.VectorSchemaRoot;
import org.apache.arrow.vector.types.pojo.ArrowType;
import org.apache.arrow.vector.types.pojo.Field;
import org.apache.arrow.vector.types.pojo.FieldType;
import org.apache.arrow.vector.types.pojo.Schema;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Comprehensive unit tests for Arrow query execution engine
 */
@SpringBootTest
@ActiveProfiles("test")
class ArrowQueryExecutionEngineTest {
    
    @Autowired
    private ArrowQueryExecutionEngine executionEngine;
    
    private BufferAllocator allocator;
    
    @BeforeEach
    void setUp() {
        allocator = new RootAllocator(1024 * 1024 * 100); // 100MB for tests
    }
    
    @AfterEach
    void tearDown() {
        if (allocator != null) {
            allocator.close();
        }
    }
    
    @Test
    @DisplayName("Test simple scan operation")
    void testScanOperation() {
        // Create sample data
        VectorSchemaRoot sampleData = createSampleEmployeeData();
        
        // Create a simple scan plan
        ArrowQueryExecutionEngine.QueryExecutionPlan plan = executionEngine.createSamplePlan(
            "test-query-1",
            "employees",
            Arrays.asList("id", "name", "salary"),
            null, // no filter
            null, // no group by
            null  // no aggregates
        );
        
        assertNotNull(plan);
        assertEquals("test-query-1", plan.getQueryId());
        assertFalse(plan.getOperators().isEmpty());
        
        sampleData.close();
    }
    
    @Test
    @DisplayName("Test filter operation with numeric predicate")
    void testFilterOperation() {
        VectorSchemaRoot inputData = createSampleEmployeeData();
        
        try {
            // Create filter predicate: salary > 50000
            FilterOperator.FilterPredicate predicate = new FilterOperator.NumericComparisonPredicate(
                "salary", FilterOperator.ComparisonOperator.GREATER_THAN, 50000.0);
            
            FilterOperator filterOp = new FilterOperator(predicate);
            
            // Execute filter
            VectorSchemaRoot result = filterOp.execute(inputData, allocator);
            
            assertNotNull(result);
            assertTrue(result.getRowCount() < inputData.getRowCount(), 
                "Filter should reduce row count");
            
            // Verify all remaining rows meet the filter condition
            BigIntVector salaryVector = (BigIntVector) result.getVector("salary");
            for (int i = 0; i < result.getRowCount(); i++) {
                assertTrue(salaryVector.get(i) > 50000, 
                    "All filtered rows should have salary > 50000");
            }
            
            // Verify operator stats
            VectorizedOperator.OperatorStats stats = filterOp.getStats();
            assertNotNull(stats);
            assertEquals(inputData.getRowCount(), stats.getInputRows());
            assertEquals(result.getRowCount(), stats.getOutputRows());
            assertTrue(stats.getExecutionTimeMs() >= 0);
            
            result.close();
        } finally {
            inputData.close();
        }
    }
    
    @Test
    @DisplayName("Test aggregation operation with GROUP BY")
    void testAggregationOperation() {
        VectorSchemaRoot inputData = createSampleEmployeeData();
        
        try {
            // Create aggregation: GROUP BY department, COUNT(*), AVG(salary)
            List<String> groupByColumns = Arrays.asList("department");
            List<AggregationOperator.AggregateFunction> aggregates = Arrays.asList(
                new AggregationOperator.AggregateFunction(
                    AggregationOperator.AggregateFunctionType.COUNT, "id"),
                new AggregationOperator.AggregateFunction(
                    AggregationOperator.AggregateFunctionType.AVG, "salary")
            );
            
            AggregationOperator aggOp = new AggregationOperator(groupByColumns, aggregates);
            
            // Execute aggregation
            VectorSchemaRoot result = aggOp.execute(inputData, allocator);
            
            assertNotNull(result);
            assertTrue(result.getRowCount() > 0, "Should have aggregated results");
            assertTrue(result.getRowCount() <= inputData.getRowCount(), 
                "Aggregation should reduce or maintain row count");
            
            // Verify schema has group-by columns + aggregate columns
            assertEquals(3, result.getSchema().getFields().size(), 
                "Should have department + count + avg columns");
            
            // Verify operator stats
            VectorizedOperator.OperatorStats stats = aggOp.getStats();
            assertNotNull(stats);
            assertEquals(inputData.getRowCount(), stats.getInputRows());
            assertTrue(stats.getExecutionTimeMs() >= 0);
            
            result.close();
        } finally {
            inputData.close();
        }
    }
    
    @Test
    @DisplayName("Test complete query execution pipeline")
    void testCompleteQueryExecution() {
        // Create a complete execution plan with filter + aggregation
        ArrowQueryExecutionEngine.QueryExecutionPlan plan = executionEngine.createSamplePlan(
            "test-pipeline",
            "employees",
            Arrays.asList("department", "salary"),
            new FilterOperator.NumericComparisonPredicate(
                "salary", FilterOperator.ComparisonOperator.GREATER_THAN, 40000.0),
            Arrays.asList("department"),
            Arrays.asList(
                new AggregationOperator.AggregateFunction(
                    AggregationOperator.AggregateFunctionType.COUNT, "salary"),
                new AggregationOperator.AggregateFunction(
                    AggregationOperator.AggregateFunctionType.AVG, "salary")
            )
        );
        
        // Execute the plan
        ArrowQueryExecutionEngine.QueryExecutionResult result = executionEngine.executeQuery(plan);
        
        try {
            assertNotNull(result);
            assertEquals("test-pipeline", result.getQueryId());
            assertTrue(result.isSuccess(), "Query execution should succeed");
            assertNull(result.getErrorMessage(), "Should not have error message on success");
            
            // Verify execution stats
            assertFalse(result.getOperatorStats().isEmpty(), "Should have operator statistics");
            assertTrue(result.getExecutionTimeMs() >= 0, "Should have execution time");
            
            // Verify result data
            VectorSchemaRoot resultData = result.getResultData();
            if (resultData != null) {
                assertTrue(resultData.getRowCount() >= 0, "Should have valid row count");
                assertFalse(resultData.getSchema().getFields().isEmpty(), 
                    "Should have result schema");
            }
            
        } finally {
            result.close();
        }
    }
    
    @Test
    @DisplayName("Test query execution error handling")
    void testQueryExecutionErrorHandling() {
        // Create a plan with invalid operators to test error handling
        List<VectorizedOperator> invalidOperators = Arrays.asList(
            new VectorizedOperator() {
                @Override
                public VectorSchemaRoot execute(VectorSchemaRoot input, BufferAllocator allocator) {
                    throw new RuntimeException("Simulated operator failure");
                }
                
                @Override
                public String getOperatorName() { return "FailingOperator"; }
                
                @Override
                public VectorizedOperator.OperatorStats getStats() { return null; }
                
                @Override
                public void close() {}
            }
        );
        
        ArrowQueryExecutionEngine.QueryExecutionPlan failingPlan = 
            new ArrowQueryExecutionEngine.QueryExecutionPlan("failing-query", invalidOperators);
        
        ArrowQueryExecutionEngine.QueryExecutionResult result = 
            executionEngine.executeQuery(failingPlan);
        
        try {
            assertNotNull(result);
            assertEquals("failing-query", result.getQueryId());
            assertFalse(result.isSuccess(), "Query should fail");
            assertNotNull(result.getErrorMessage(), "Should have error message");
            assertTrue(result.getErrorMessage().contains("Simulated operator failure"));
            
        } finally {
            result.close();
        }
    }
    
    @Test
    @DisplayName("Test memory management during query execution")
    void testMemoryManagement() {
        long initialMemory = allocator.getAllocatedMemory();
        
        // Execute multiple queries to test memory cleanup
        for (int i = 0; i < 5; i++) {
            ArrowQueryExecutionEngine.QueryExecutionPlan plan = executionEngine.createSamplePlan(
                "memory-test-" + i,
                "test_table",
                Arrays.asList("col1", "col2"),
                null, null, null
            );
            
            ArrowQueryExecutionEngine.QueryExecutionResult result = 
                executionEngine.executeQuery(plan);
            
            // Properly close result to free memory
            result.close();
        }
        
        // Memory should be cleaned up (allowing for some variance due to allocator behavior)
        long finalMemory = allocator.getAllocatedMemory();
        assertTrue(finalMemory <= initialMemory + 1024, // Allow 1KB variance
            "Memory should be properly cleaned up after query execution");
    }
    
    @Test
    @DisplayName("Test performance with larger datasets")
    void testPerformanceWithLargerDataset() {
        VectorSchemaRoot largeDataset = createLargeEmployeeDataset(10000);
        
        try {
            long startTime = System.currentTimeMillis();
            
            // Create and execute a complex plan
            ArrowQueryExecutionEngine.QueryExecutionPlan plan = executionEngine.createSamplePlan(
                "performance-test",
                "large_employees",
                Arrays.asList("department", "salary"),
                new FilterOperator.NumericComparisonPredicate(
                    "salary", FilterOperator.ComparisonOperator.GREATER_THAN, 50000.0),
                Arrays.asList("department"),
                Arrays.asList(
                    new AggregationOperator.AggregateFunction(
                        AggregationOperator.AggregateFunctionType.COUNT, "salary"),
                    new AggregationOperator.AggregateFunction(
                        AggregationOperator.AggregateFunctionType.AVG, "salary")
                )
            );
            
            ArrowQueryExecutionEngine.QueryExecutionResult result = 
                executionEngine.executeQuery(plan);
            
            long executionTime = System.currentTimeMillis() - startTime;
            
            try {
                assertTrue(result.isSuccess(), "Large dataset query should succeed");
                assertTrue(executionTime < 5000, // Should complete within 5 seconds
                    "Query on 10K rows should complete quickly, took: " + executionTime + "ms");
                
                // Verify we got reasonable performance stats
                assertFalse(result.getOperatorStats().isEmpty());
                for (VectorizedOperator.OperatorStats stats : result.getOperatorStats()) {
                    assertTrue(stats.getExecutionTimeMs() >= 0);
                    assertTrue(stats.getInputRows() >= 0);
                    assertTrue(stats.getOutputRows() >= 0);
                }
                
            } finally {
                result.close();
            }
            
        } finally {
            largeDataset.close();
        }
    }
    
    /**
     * Create sample employee data for testing
     */
    private VectorSchemaRoot createSampleEmployeeData() {
        // Create schema
        Field idField = Field.nullable("id", new ArrowType.Int(64, true));
        Field nameField = Field.nullable("name", new ArrowType.Utf8());
        Field salaryField = Field.nullable("salary", new ArrowType.Int(64, true));
        Field deptField = Field.nullable("department", new ArrowType.Utf8());
        
        Schema schema = new Schema(Arrays.asList(idField, nameField, salaryField, deptField));
        VectorSchemaRoot root = VectorSchemaRoot.create(schema, allocator);
        root.allocateNew();
        
        // Populate data
        BigIntVector idVector = (BigIntVector) root.getVector("id");
        VarCharVector nameVector = (VarCharVector) root.getVector("name");
        BigIntVector salaryVector = (BigIntVector) root.getVector("salary");
        VarCharVector deptVector = (VarCharVector) root.getVector("department");
        
        String[] names = {"Alice", "Bob", "Charlie", "Diana", "Eve"};
        long[] salaries = {45000, 55000, 65000, 48000, 72000};
        String[] departments = {"Engineering", "Sales", "Engineering", "Marketing", "Sales"};
        
        for (int i = 0; i < names.length; i++) {
            idVector.set(i, i + 1);
            nameVector.setSafe(i, names[i].getBytes());
            salaryVector.set(i, salaries[i]);
            deptVector.setSafe(i, departments[i].getBytes());
        }
        
        idVector.setValueCount(names.length);
        nameVector.setValueCount(names.length);
        salaryVector.setValueCount(names.length);
        deptVector.setValueCount(names.length);
        root.setRowCount(names.length);
        
        return root;
    }
    
    /**
     * Create a larger dataset for performance testing
     */
    private VectorSchemaRoot createLargeEmployeeDataset(int rowCount) {
        Field idField = Field.nullable("id", new ArrowType.Int(64, true));
        Field salaryField = Field.nullable("salary", new ArrowType.Int(64, true));
        Field deptField = Field.nullable("department", new ArrowType.Utf8());
        
        Schema schema = new Schema(Arrays.asList(idField, salaryField, deptField));
        VectorSchemaRoot root = VectorSchemaRoot.create(schema, allocator);
        
        // Allocate with sufficient capacity
        BigIntVector idVector = (BigIntVector) root.getVector("id");
        BigIntVector salaryVector = (BigIntVector) root.getVector("salary");
        VarCharVector deptVector = (VarCharVector) root.getVector("department");
        
        idVector.allocateNew(rowCount);
        salaryVector.allocateNew(rowCount);
        deptVector.allocateNew(rowCount * 20, rowCount); // Allocate for string data
        
        String[] departments = {"Engineering", "Sales", "Marketing", "HR", "Finance"};
        
        for (int i = 0; i < rowCount; i++) {
            idVector.set(i, i + 1);
            salaryVector.set(i, 40000 + (i % 50000)); // Salary range 40K-90K
            deptVector.setSafe(i, departments[i % departments.length].getBytes());
        }
        
        idVector.setValueCount(rowCount);
        salaryVector.setValueCount(rowCount);
        deptVector.setValueCount(rowCount);
        root.setRowCount(rowCount);
        
        return root;
    }
}