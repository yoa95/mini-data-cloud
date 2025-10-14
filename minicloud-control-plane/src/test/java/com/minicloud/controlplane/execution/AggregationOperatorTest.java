package com.minicloud.controlplane.execution;

import org.apache.arrow.memory.BufferAllocator;
import org.apache.arrow.memory.RootAllocator;
import org.apache.arrow.vector.BigIntVector;
import org.apache.arrow.vector.VarCharVector;
import org.apache.arrow.vector.VectorSchemaRoot;
import org.apache.arrow.vector.types.pojo.ArrowType;
import org.apache.arrow.vector.types.pojo.Field;
import org.apache.arrow.vector.types.pojo.Schema;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for AggregationOperator
 */
class AggregationOperatorTest {
    
    private BufferAllocator allocator;
    
    @BeforeEach
    void setUp() {
        allocator = new RootAllocator(1024 * 1024 * 10); // 10MB for tests
    }
    
    @AfterEach
    void tearDown() {
        if (allocator != null) {
            allocator.close();
        }
    }
    
    @Test
    @DisplayName("Test simple COUNT aggregation")
    void testCountAggregation() {
        VectorSchemaRoot input = createSalesTestData();
        
        try {
            List<String> groupByColumns = Arrays.asList("department");
            List<AggregationOperator.AggregateFunction> aggregates = Arrays.asList(
                new AggregationOperator.AggregateFunction(
                    AggregationOperator.AggregateFunctionType.COUNT, "sales")
            );
            
            AggregationOperator aggOp = new AggregationOperator(groupByColumns, aggregates);
            VectorSchemaRoot result = aggOp.execute(input, allocator);
            
            try {
                assertNotNull(result);
                assertTrue(result.getRowCount() > 0, "Should have aggregated results");
                assertTrue(result.getRowCount() <= input.getRowCount(), 
                    "Aggregation should reduce or maintain row count");
                
                // Verify schema: department + count_sales
                assertEquals(2, result.getSchema().getFields().size());
                assertEquals("department", result.getSchema().getFields().get(0).getName());
                assertTrue(result.getSchema().getFields().get(1).getName().contains("count"));
                
                // Verify operator stats
                VectorizedOperator.OperatorStats stats = aggOp.getStats();
                assertNotNull(stats);
                assertEquals(input.getRowCount(), stats.getInputRows());
                assertEquals(result.getRowCount(), stats.getOutputRows());
                assertTrue(stats.getExecutionTimeMs() >= 0);
                
            } finally {
                result.close();
            }
        } finally {
            input.close();
        }
    }
    
    @Test
    @DisplayName("Test SUM aggregation")
    void testSumAggregation() {
        VectorSchemaRoot input = createSalesTestData();
        
        try {
            List<String> groupByColumns = Arrays.asList("department");
            List<AggregationOperator.AggregateFunction> aggregates = Arrays.asList(
                new AggregationOperator.AggregateFunction(
                    AggregationOperator.AggregateFunctionType.SUM, "sales")
            );
            
            AggregationOperator aggOp = new AggregationOperator(groupByColumns, aggregates);
            VectorSchemaRoot result = aggOp.execute(input, allocator);
            
            try {
                assertNotNull(result);
                assertTrue(result.getRowCount() > 0);
                
                // Verify we have department and sum columns
                assertEquals(2, result.getSchema().getFields().size());
                assertTrue(result.getSchema().getFields().get(1).getName().contains("sum"));
                
                // Manually verify sum calculation for known data
                // Engineering: 1000 + 1500 = 2500
                // Sales: 1200 + 800 = 2000
                VarCharVector deptVector = (VarCharVector) result.getVector("department");
                VarCharVector sumVector = (VarCharVector) result.getVector(1); // sum column
                
                boolean foundEngineering = false, foundSales = false;
                for (int i = 0; i < result.getRowCount(); i++) {
                    String dept = new String(deptVector.get(i));
                    double sum = Double.parseDouble(new String(sumVector.get(i)));
                    
                    if ("Engineering".equals(dept)) {
                        assertEquals(2500.0, sum, 0.01, "Engineering sum should be 2500");
                        foundEngineering = true;
                    } else if ("Sales".equals(dept)) {
                        assertEquals(2000.0, sum, 0.01, "Sales sum should be 2000");
                        foundSales = true;
                    }
                }
                
                assertTrue(foundEngineering && foundSales, "Should find both departments");
                
            } finally {
                result.close();
            }
        } finally {
            input.close();
        }
    }
    
    @Test
    @DisplayName("Test AVG aggregation")
    void testAvgAggregation() {
        VectorSchemaRoot input = createSalesTestData();
        
        try {
            List<String> groupByColumns = Arrays.asList("department");
            List<AggregationOperator.AggregateFunction> aggregates = Arrays.asList(
                new AggregationOperator.AggregateFunction(
                    AggregationOperator.AggregateFunctionType.AVG, "sales")
            );
            
            AggregationOperator aggOp = new AggregationOperator(groupByColumns, aggregates);
            VectorSchemaRoot result = aggOp.execute(input, allocator);
            
            try {
                assertNotNull(result);
                assertTrue(result.getRowCount() > 0);
                
                // Verify average calculations
                VarCharVector deptVector = (VarCharVector) result.getVector("department");
                VarCharVector avgVector = (VarCharVector) result.getVector(1);
                
                for (int i = 0; i < result.getRowCount(); i++) {
                    String dept = new String(deptVector.get(i));
                    double avg = Double.parseDouble(new String(avgVector.get(i)));
                    
                    if ("Engineering".equals(dept)) {
                        assertEquals(1250.0, avg, 0.01, "Engineering avg should be 1250");
                    } else if ("Sales".equals(dept)) {
                        assertEquals(1000.0, avg, 0.01, "Sales avg should be 1000");
                    }
                }
                
            } finally {
                result.close();
            }
        } finally {
            input.close();
        }
    }
    
    @Test
    @DisplayName("Test MIN and MAX aggregation")
    void testMinMaxAggregation() {
        VectorSchemaRoot input = createSalesTestData();
        
        try {
            List<String> groupByColumns = Arrays.asList("department");
            List<AggregationOperator.AggregateFunction> aggregates = Arrays.asList(
                new AggregationOperator.AggregateFunction(
                    AggregationOperator.AggregateFunctionType.MIN, "sales"),
                new AggregationOperator.AggregateFunction(
                    AggregationOperator.AggregateFunctionType.MAX, "sales")
            );
            
            AggregationOperator aggOp = new AggregationOperator(groupByColumns, aggregates);
            VectorSchemaRoot result = aggOp.execute(input, allocator);
            
            try {
                assertNotNull(result);
                assertEquals(3, result.getSchema().getFields().size()); // dept + min + max
                
                VarCharVector deptVector = (VarCharVector) result.getVector("department");
                VarCharVector minVector = (VarCharVector) result.getVector(1);
                VarCharVector maxVector = (VarCharVector) result.getVector(2);
                
                for (int i = 0; i < result.getRowCount(); i++) {
                    String dept = new String(deptVector.get(i));
                    double min = Double.parseDouble(new String(minVector.get(i)));
                    double max = Double.parseDouble(new String(maxVector.get(i)));
                    
                    if ("Engineering".equals(dept)) {
                        assertEquals(1000.0, min, 0.01);
                        assertEquals(1500.0, max, 0.01);
                    } else if ("Sales".equals(dept)) {
                        assertEquals(800.0, min, 0.01);
                        assertEquals(1200.0, max, 0.01);
                    }
                    
                    assertTrue(min <= max, "Min should be <= Max");
                }
                
            } finally {
                result.close();
            }
        } finally {
            input.close();
        }
    }
    
    @ParameterizedTest
    @EnumSource(AggregationOperator.AggregateFunctionType.class)
    @DisplayName("Test all aggregate function types")
    void testAllAggregateFunctionTypes(AggregationOperator.AggregateFunctionType funcType) {
        VectorSchemaRoot input = createSalesTestData();
        
        try {
            List<String> groupByColumns = Arrays.asList("department");
            List<AggregationOperator.AggregateFunction> aggregates = Arrays.asList(
                new AggregationOperator.AggregateFunction(funcType, "sales")
            );
            
            AggregationOperator aggOp = new AggregationOperator(groupByColumns, aggregates);
            VectorSchemaRoot result = aggOp.execute(input, allocator);
            
            try {
                assertNotNull(result);
                assertTrue(result.getRowCount() > 0, 
                    "Should have results for function type: " + funcType);
                assertEquals(2, result.getSchema().getFields().size());
                
                // Verify all aggregate values are reasonable
                VarCharVector aggVector = (VarCharVector) result.getVector(1);
                for (int i = 0; i < result.getRowCount(); i++) {
                    double value = Double.parseDouble(new String(aggVector.get(i)));
                    assertTrue(value >= 0, "Aggregate value should be non-negative: " + value);
                    
                    // For COUNT, should be integer values
                    if (funcType == AggregationOperator.AggregateFunctionType.COUNT) {
                        assertEquals(value, Math.floor(value), 0.01, 
                            "COUNT should produce integer values");
                    }
                }
                
            } finally {
                result.close();
            }
        } finally {
            input.close();
        }
    }
    
    @Test
    @DisplayName("Test multiple group-by columns")
    void testMultipleGroupByColumns() {
        VectorSchemaRoot input = createDetailedSalesData();
        
        try {
            List<String> groupByColumns = Arrays.asList("department", "region");
            List<AggregationOperator.AggregateFunction> aggregates = Arrays.asList(
                new AggregationOperator.AggregateFunction(
                    AggregationOperator.AggregateFunctionType.COUNT, "sales"),
                new AggregationOperator.AggregateFunction(
                    AggregationOperator.AggregateFunctionType.SUM, "sales")
            );
            
            AggregationOperator aggOp = new AggregationOperator(groupByColumns, aggregates);
            VectorSchemaRoot result = aggOp.execute(input, allocator);
            
            try {
                assertNotNull(result);
                assertTrue(result.getRowCount() > 0);
                
                // Should have department + region + count + sum = 4 columns
                assertEquals(4, result.getSchema().getFields().size());
                
                // Verify we have the expected group-by columns
                assertEquals("department", result.getSchema().getFields().get(0).getName());
                assertEquals("region", result.getSchema().getFields().get(1).getName());
                
            } finally {
                result.close();
            }
        } finally {
            input.close();
        }
    }
    
    @Test
    @DisplayName("Test aggregation with null values")
    void testAggregationWithNulls() {
        VectorSchemaRoot input = createDataWithNulls();
        
        try {
            List<String> groupByColumns = Arrays.asList("category");
            List<AggregationOperator.AggregateFunction> aggregates = Arrays.asList(
                new AggregationOperator.AggregateFunction(
                    AggregationOperator.AggregateFunctionType.COUNT, "value"),
                new AggregationOperator.AggregateFunction(
                    AggregationOperator.AggregateFunctionType.SUM, "value")
            );
            
            AggregationOperator aggOp = new AggregationOperator(groupByColumns, aggregates);
            VectorSchemaRoot result = aggOp.execute(input, allocator);
            
            try {
                assertNotNull(result);
                assertTrue(result.getRowCount() > 0);
                
                // Verify that null values are handled properly
                // COUNT should count all rows, SUM should ignore nulls
                VarCharVector countVector = (VarCharVector) result.getVector(1);
                VarCharVector sumVector = (VarCharVector) result.getVector(2);
                
                for (int i = 0; i < result.getRowCount(); i++) {
                    double count = Double.parseDouble(new String(countVector.get(i)));
                    double sum = Double.parseDouble(new String(sumVector.get(i)));
                    
                    assertTrue(count >= 0, "Count should be non-negative");
                    assertTrue(sum >= 0, "Sum should be non-negative");
                }
                
            } finally {
                result.close();
            }
        } finally {
            input.close();
        }
    }
    
    @Test
    @DisplayName("Test aggregation performance with large dataset")
    void testAggregationPerformance() {
        VectorSchemaRoot input = createLargeSalesData(50000);
        
        try {
            List<String> groupByColumns = Arrays.asList("department");
            List<AggregationOperator.AggregateFunction> aggregates = Arrays.asList(
                new AggregationOperator.AggregateFunction(
                    AggregationOperator.AggregateFunctionType.COUNT, "sales"),
                new AggregationOperator.AggregateFunction(
                    AggregationOperator.AggregateFunctionType.AVG, "sales")
            );
            
            AggregationOperator aggOp = new AggregationOperator(groupByColumns, aggregates);
            
            long startTime = System.currentTimeMillis();
            VectorSchemaRoot result = aggOp.execute(input, allocator);
            long executionTime = System.currentTimeMillis() - startTime;
            
            try {
                assertNotNull(result);
                assertTrue(executionTime < 2000, // Should complete within 2 seconds
                    "Aggregation on 50K rows should be fast, took: " + executionTime + "ms");
                
                VectorizedOperator.OperatorStats stats = aggOp.getStats();
                assertEquals(50000, stats.getInputRows());
                assertTrue(stats.getOutputRows() < stats.getInputRows());
                
            } finally {
                result.close();
            }
        } finally {
            input.close();
        }
    }
    
    /**
     * Create sample sales data for testing
     */
    private VectorSchemaRoot createSalesTestData() {
        Field deptField = Field.nullable("department", new ArrowType.Utf8());
        Field salesField = Field.nullable("sales", new ArrowType.Int(64, true));
        
        Schema schema = new Schema(Arrays.asList(deptField, salesField));
        VectorSchemaRoot root = VectorSchemaRoot.create(schema, allocator);
        root.allocateNew();
        
        VarCharVector deptVector = (VarCharVector) root.getVector("department");
        BigIntVector salesVector = (BigIntVector) root.getVector("sales");
        
        String[] departments = {"Engineering", "Sales", "Engineering", "Sales"};
        long[] sales = {1000, 1200, 1500, 800};
        
        for (int i = 0; i < departments.length; i++) {
            deptVector.setSafe(i, departments[i].getBytes());
            salesVector.set(i, sales[i]);
        }
        
        deptVector.setValueCount(departments.length);
        salesVector.setValueCount(departments.length);
        root.setRowCount(departments.length);
        
        return root;
    }
    
    /**
     * Create detailed sales data with multiple dimensions
     */
    private VectorSchemaRoot createDetailedSalesData() {
        Field deptField = Field.nullable("department", new ArrowType.Utf8());
        Field regionField = Field.nullable("region", new ArrowType.Utf8());
        Field salesField = Field.nullable("sales", new ArrowType.Int(64, true));
        
        Schema schema = new Schema(Arrays.asList(deptField, regionField, salesField));
        VectorSchemaRoot root = VectorSchemaRoot.create(schema, allocator);
        root.allocateNew();
        
        VarCharVector deptVector = (VarCharVector) root.getVector("department");
        VarCharVector regionVector = (VarCharVector) root.getVector("region");
        BigIntVector salesVector = (BigIntVector) root.getVector("sales");
        
        String[] departments = {"Engineering", "Sales", "Engineering", "Sales", "Marketing"};
        String[] regions = {"North", "South", "North", "East", "West"};
        long[] sales = {1000, 1200, 1500, 800, 900};
        
        for (int i = 0; i < departments.length; i++) {
            deptVector.setSafe(i, departments[i].getBytes());
            regionVector.setSafe(i, regions[i].getBytes());
            salesVector.set(i, sales[i]);
        }
        
        deptVector.setValueCount(departments.length);
        regionVector.setValueCount(departments.length);
        salesVector.setValueCount(departments.length);
        root.setRowCount(departments.length);
        
        return root;
    }
    
    /**
     * Create data with null values for testing
     */
    private VectorSchemaRoot createDataWithNulls() {
        Field categoryField = Field.nullable("category", new ArrowType.Utf8());
        Field valueField = Field.nullable("value", new ArrowType.Int(64, true));
        
        Schema schema = new Schema(Arrays.asList(categoryField, valueField));
        VectorSchemaRoot root = VectorSchemaRoot.create(schema, allocator);
        root.allocateNew();
        
        VarCharVector categoryVector = (VarCharVector) root.getVector("category");
        BigIntVector valueVector = (BigIntVector) root.getVector("value");
        
        String[] categories = {"A", "B", "A", "B", "A"};
        Long[] values = {100L, null, 200L, 150L, null}; // Some null values
        
        for (int i = 0; i < categories.length; i++) {
            categoryVector.setSafe(i, categories[i].getBytes());
            if (values[i] != null) {
                valueVector.set(i, values[i]);
            }
            // Leave null values as null
        }
        
        categoryVector.setValueCount(categories.length);
        valueVector.setValueCount(categories.length);
        root.setRowCount(categories.length);
        
        return root;
    }
    
    /**
     * Create large dataset for performance testing
     */
    private VectorSchemaRoot createLargeSalesData(int rowCount) {
        Field deptField = Field.nullable("department", new ArrowType.Utf8());
        Field salesField = Field.nullable("sales", new ArrowType.Int(64, true));
        
        Schema schema = new Schema(Arrays.asList(deptField, salesField));
        VectorSchemaRoot root = VectorSchemaRoot.create(schema, allocator);
        
        // Allocate with sufficient capacity
        VarCharVector deptVector = (VarCharVector) root.getVector("department");
        BigIntVector salesVector = (BigIntVector) root.getVector("sales");
        deptVector.allocateNew(rowCount * 20, rowCount); // Allocate for string data
        salesVector.allocateNew(rowCount);
        
        String[] departments = {"Engineering", "Sales", "Marketing", "HR", "Finance"};
        
        for (int i = 0; i < rowCount; i++) {
            String dept = departments[i % departments.length];
            long sales = 1000 + (i % 5000); // Sales values from 1000 to 6000
            
            deptVector.setSafe(i, dept.getBytes());
            salesVector.set(i, sales);
        }
        
        deptVector.setValueCount(rowCount);
        salesVector.setValueCount(rowCount);
        root.setRowCount(rowCount);
        
        return root;
    }
}