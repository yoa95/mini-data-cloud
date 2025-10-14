package com.minicloud.controlplane.execution;

import org.apache.arrow.memory.BufferAllocator;
import org.apache.arrow.vector.VectorSchemaRoot;
import org.apache.arrow.vector.FieldVector;
import org.apache.arrow.vector.BigIntVector;
import org.apache.arrow.vector.Float8Vector;
import org.apache.arrow.vector.VarCharVector;
import org.apache.arrow.vector.types.pojo.Field;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Predicate;

/**
 * Filter operator that applies predicates to Arrow vectors.
 * Supports basic filtering operations on different data types.
 */
public class FilterOperator implements VectorizedOperator {
    
    private final FilterPredicate predicate;
    private OperatorStats stats;
    
    public FilterOperator(FilterPredicate predicate) {
        this.predicate = predicate;
    }
    
    @Override
    public VectorSchemaRoot execute(VectorSchemaRoot input, BufferAllocator allocator) {
        long startTime = System.currentTimeMillis();
        int inputRows = input.getRowCount();
        
        // Create output schema (same as input)
        VectorSchemaRoot result = VectorSchemaRoot.create(input.getSchema(), allocator);
        result.allocateNew();
        
        // Apply filter and collect matching row indices
        List<Integer> matchingRows = new ArrayList<>();
        for (int row = 0; row < inputRows; row++) {
            if (predicate.test(input, row)) {
                matchingRows.add(row);
            }
        }
        
        int outputRows = matchingRows.size();
        
        // Copy matching rows to output vectors
        for (int fieldIndex = 0; fieldIndex < input.getSchema().getFields().size(); fieldIndex++) {
            FieldVector inputVector = input.getVector(fieldIndex);
            FieldVector outputVector = result.getVector(fieldIndex);
            
            copyMatchingRows(inputVector, outputVector, matchingRows);
        }
        
        result.setRowCount(outputRows);
        
        long executionTime = System.currentTimeMillis() - startTime;
        this.stats = new OperatorStats(inputRows, outputRows, executionTime, 
            result.getSchema().getFields().size() * outputRows * 8);
        
        return result;
    }
    
    private void copyMatchingRows(FieldVector input, FieldVector output, List<Integer> matchingRows) {
        if (input instanceof BigIntVector) {
            BigIntVector inputVec = (BigIntVector) input;
            BigIntVector outputVec = (BigIntVector) output;
            for (int i = 0; i < matchingRows.size(); i++) {
                int sourceRow = matchingRows.get(i);
                if (!inputVec.isNull(sourceRow)) {
                    outputVec.set(i, inputVec.get(sourceRow));
                }
            }
            outputVec.setValueCount(matchingRows.size());

        } else if (input instanceof VarCharVector) {
            VarCharVector inputVec = (VarCharVector) input;
            VarCharVector outputVec = (VarCharVector) output;
            for (int i = 0; i < matchingRows.size(); i++) {
                int sourceRow = matchingRows.get(i);
                if (!inputVec.isNull(sourceRow)) {
                    byte[] value = inputVec.get(sourceRow);
                    outputVec.setSafe(i, value);
                }
            }
            outputVec.setValueCount(matchingRows.size());
        }
    }
    
    @Override
    public String getOperatorName() {
        return "FilterOperator[" + predicate.getDescription() + "]";
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
     * Interface for filter predicates that can be applied to Arrow data.
     */
    public interface FilterPredicate {
        boolean test(VectorSchemaRoot data, int rowIndex);
        String getDescription();
    }
    
    /**
     * Simple numeric comparison predicate.
     */
    public static class NumericComparisonPredicate implements FilterPredicate {
        private final String columnName;
        private final ComparisonOperator operator;
        private final double value;
        
        public NumericComparisonPredicate(String columnName, ComparisonOperator operator, double value) {
            this.columnName = columnName;
            this.operator = operator;
            this.value = value;
        }
        
        @Override
        public boolean test(VectorSchemaRoot data, int rowIndex) {
            FieldVector vector = data.getVector(columnName);
            if (vector == null || vector.isNull(rowIndex)) {
                return false;
            }
            
            double rowValue;
            if (vector instanceof BigIntVector) {
                rowValue = ((BigIntVector) vector).get(rowIndex);
            } else if (vector instanceof VarCharVector) {
                try {
                    String value = new String(((VarCharVector) vector).get(rowIndex));
                    rowValue = Double.parseDouble(value);
                } catch (NumberFormatException e) {
                    return false;
                }
            } else {
                return false; // Unsupported type for numeric comparison
            }
            
            return switch (operator) {
                case EQUALS -> rowValue == value;
                case GREATER_THAN -> rowValue > value;
                case LESS_THAN -> rowValue < value;
                case GREATER_THAN_OR_EQUAL -> rowValue >= value;
                case LESS_THAN_OR_EQUAL -> rowValue <= value;
            };
        }
        
        @Override
        public String getDescription() {
            return columnName + " " + operator + " " + value;
        }
    }
    
    public enum ComparisonOperator {
        EQUALS, GREATER_THAN, LESS_THAN, GREATER_THAN_OR_EQUAL, LESS_THAN_OR_EQUAL
    }
}