package com.minicloud.controlplane.execution;

import org.apache.arrow.memory.BufferAllocator;
import org.apache.arrow.vector.VectorSchemaRoot;
import org.apache.arrow.vector.FieldVector;
import org.apache.arrow.vector.BigIntVector;
import org.apache.arrow.vector.Float8Vector;
import org.apache.arrow.vector.VarCharVector;
import org.apache.arrow.vector.types.pojo.Field;
import org.apache.arrow.vector.types.pojo.Schema;
import org.apache.arrow.vector.types.pojo.ArrowType;

import java.util.*;

/**
 * Aggregation operator that performs GROUP BY operations with aggregate functions.
 * Supports basic aggregation functions like COUNT, SUM, AVG, MIN, MAX.
 */
public class AggregationOperator implements VectorizedOperator {
    
    private final List<String> groupByColumns;
    private final List<AggregateFunction> aggregateFunctions;
    private OperatorStats stats;
    
    public AggregationOperator(List<String> groupByColumns, List<AggregateFunction> aggregateFunctions) {
        this.groupByColumns = new ArrayList<>(groupByColumns);
        this.aggregateFunctions = new ArrayList<>(aggregateFunctions);
    }
    
    @Override
    public VectorSchemaRoot execute(VectorSchemaRoot input, BufferAllocator allocator) {
        long startTime = System.currentTimeMillis();
        int inputRows = input.getRowCount();
        
        // Group rows by group-by columns
        Map<GroupKey, List<Integer>> groups = groupRows(input);
        
        // Create output schema
        Schema outputSchema = createOutputSchema(input);
        VectorSchemaRoot result = VectorSchemaRoot.create(outputSchema, allocator);
        result.allocateNew();
        
        // Process each group and compute aggregates
        int outputRowIndex = 0;
        for (Map.Entry<GroupKey, List<Integer>> entry : groups.entrySet()) {
            GroupKey groupKey = entry.getKey();
            List<Integer> rowIndices = entry.getValue();
            
            // Set group-by column values
            for (int i = 0; i < groupByColumns.size(); i++) {
                String columnName = groupByColumns.get(i);
                FieldVector outputVector = result.getVector(i);
                Object groupValue = groupKey.getValues().get(i);
                setVectorValue(outputVector, outputRowIndex, groupValue);
            }
            
            // Compute aggregate functions
            for (int i = 0; i < aggregateFunctions.size(); i++) {
                AggregateFunction aggFunc = aggregateFunctions.get(i);
                FieldVector outputVector = result.getVector(groupByColumns.size() + i);
                double aggregateValue = computeAggregate(input, aggFunc, rowIndices);
                setVectorValue(outputVector, outputRowIndex, aggregateValue);
            }
            
            outputRowIndex++;
        }
        
        // Set value counts for all vectors
        for (FieldVector vector : result.getFieldVectors()) {
            vector.setValueCount(outputRowIndex);
        }
        
        result.setRowCount(outputRowIndex);
        
        long executionTime = System.currentTimeMillis() - startTime;
        this.stats = new OperatorStats(inputRows, outputRowIndex, executionTime, 
            result.getSchema().getFields().size() * outputRowIndex * 8);
        
        return result;
    }
    
    private Map<GroupKey, List<Integer>> groupRows(VectorSchemaRoot input) {
        Map<GroupKey, List<Integer>> groups = new HashMap<>();
        
        for (int row = 0; row < input.getRowCount(); row++) {
            List<Object> keyValues = new ArrayList<>();
            
            for (String columnName : groupByColumns) {
                FieldVector vector = input.getVector(columnName);
                Object value = getVectorValue(vector, row);
                keyValues.add(value);
            }
            
            GroupKey key = new GroupKey(keyValues);
            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(row);
        }
        
        return groups;
    }
    
    private Object getVectorValue(FieldVector vector, int index) {
        if (vector.isNull(index)) {
            return null;
        }
        
        if (vector instanceof BigIntVector) {
            return ((BigIntVector) vector).get(index);
        } else if (vector instanceof Float8Vector) {
            return ((Float8Vector) vector).get(index);
        } else if (vector instanceof VarCharVector) {
            return new String(((VarCharVector) vector).get(index));
        }
        
        return null;
    }
    
    private void setVectorValue(FieldVector vector, int index, Object value) {
        if (value == null) {
            return; // Leave as null
        }
        
        if (vector instanceof BigIntVector) {
            ((BigIntVector) vector).set(index, ((Number) value).longValue());
        } else if (vector instanceof VarCharVector) {
            ((VarCharVector) vector).setSafe(index, value.toString().getBytes());
        }
    }
    
    private double computeAggregate(VectorSchemaRoot input, AggregateFunction aggFunc, List<Integer> rowIndices) {
        FieldVector vector = input.getVector(aggFunc.getColumnName());
        
        return switch (aggFunc.getFunction()) {
            case COUNT -> rowIndices.size();
            case SUM -> {
                double sum = 0;
                for (int row : rowIndices) {
                    if (!vector.isNull(row)) {
                        sum += getNumericValue(vector, row);
                    }
                }
                yield sum;
            }
            case AVG -> {
                double sum = 0;
                int count = 0;
                for (int row : rowIndices) {
                    if (!vector.isNull(row)) {
                        sum += getNumericValue(vector, row);
                        count++;
                    }
                }
                yield count > 0 ? sum / count : 0;
            }
            case MIN -> {
                double min = Double.MAX_VALUE;
                for (int row : rowIndices) {
                    if (!vector.isNull(row)) {
                        min = Math.min(min, getNumericValue(vector, row));
                    }
                }
                yield min == Double.MAX_VALUE ? 0 : min;
            }
            case MAX -> {
                double max = Double.MIN_VALUE;
                for (int row : rowIndices) {
                    if (!vector.isNull(row)) {
                        max = Math.max(max, getNumericValue(vector, row));
                    }
                }
                yield max == Double.MIN_VALUE ? 0 : max;
            }
        };
    }
    
    private double getNumericValue(FieldVector vector, int index) {
        if (vector instanceof BigIntVector) {
            return ((BigIntVector) vector).get(index);
        } else if (vector instanceof VarCharVector) {
            try {
                String value = new String(((VarCharVector) vector).get(index));
                return Double.parseDouble(value);
            } catch (NumberFormatException e) {
                return 0;
            }
        }
        return 0;
    }
    
    private Schema createOutputSchema(VectorSchemaRoot input) {
        List<Field> outputFields = new ArrayList<>();
        
        // Add group-by columns
        for (String columnName : groupByColumns) {
            FieldVector inputVector = input.getVector(columnName);
            outputFields.add(inputVector.getField());
        }
        
        // Add aggregate function result columns
        for (AggregateFunction aggFunc : aggregateFunctions) {
            String fieldName = aggFunc.getFunction().name().toLowerCase() + "_" + aggFunc.getColumnName();
            Field field = Field.nullable(fieldName, ArrowType.Utf8.INSTANCE);
            outputFields.add(field);
        }
        
        return new Schema(outputFields);
    }
    
    @Override
    public String getOperatorName() {
        return "AggregationOperator[groupBy=" + String.join(",", groupByColumns) + 
               ", aggregates=" + aggregateFunctions.size() + "]";
    }
    
    @Override
    public OperatorStats getStats() {
        return stats;
    }
    
    @Override
    public void close() {
        // No resources to clean up
    }
    
    /**
     * Represents a group key for GROUP BY operations.
     */
    private static class GroupKey {
        private final List<Object> values;
        
        public GroupKey(List<Object> values) {
            this.values = values;
        }
        
        public List<Object> getValues() {
            return values;
        }
        
        @Override
        public boolean equals(Object obj) {
            if (this == obj) return true;
            if (obj == null || getClass() != obj.getClass()) return false;
            GroupKey groupKey = (GroupKey) obj;
            return Objects.equals(values, groupKey.values);
        }
        
        @Override
        public int hashCode() {
            return Objects.hash(values);
        }
    }
    
    /**
     * Represents an aggregate function to be computed.
     */
    public static class AggregateFunction {
        private final AggregateFunctionType function;
        private final String columnName;
        
        public AggregateFunction(AggregateFunctionType function, String columnName) {
            this.function = function;
            this.columnName = columnName;
        }
        
        public AggregateFunctionType getFunction() { return function; }
        public String getColumnName() { return columnName; }
    }
    
    public enum AggregateFunctionType {
        COUNT, SUM, AVG, MIN, MAX
    }
}