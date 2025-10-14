package com.minicloud.controlplane.execution;

import org.apache.arrow.memory.BufferAllocator;
import org.apache.arrow.vector.VectorSchemaRoot;
import org.apache.arrow.vector.FieldVector;
import org.apache.arrow.vector.types.pojo.Field;
import org.apache.arrow.vector.types.pojo.Schema;

import java.util.ArrayList;
import java.util.List;

/**
 * Project operator that selects specific columns from Arrow vectors.
 * Implements column pruning for efficient data processing.
 */
public class ProjectOperator implements VectorizedOperator {
    
    private final List<String> selectedColumns;
    private OperatorStats stats;
    
    public ProjectOperator(List<String> selectedColumns) {
        this.selectedColumns = new ArrayList<>(selectedColumns);
    }
    
    @Override
    public VectorSchemaRoot execute(VectorSchemaRoot input, BufferAllocator allocator) {
        long startTime = System.currentTimeMillis();
        int inputRows = input.getRowCount();
        
        // Create output schema with only selected columns
        List<Field> outputFields = new ArrayList<>();
        List<FieldVector> selectedVectors = new ArrayList<>();
        
        for (String columnName : selectedColumns) {
            FieldVector inputVector = input.getVector(columnName);
            if (inputVector != null) {
                outputFields.add(inputVector.getField());
                selectedVectors.add(inputVector);
            }
        }
        
        Schema outputSchema = new Schema(outputFields);
        VectorSchemaRoot result = VectorSchemaRoot.create(outputSchema, allocator);
        result.allocateNew();
        
        // Copy selected columns to output
        for (int i = 0; i < selectedVectors.size(); i++) {
            FieldVector inputVector = selectedVectors.get(i);
            FieldVector outputVector = result.getVector(i);
            
            // Copy all values from input to output
            copyVector(inputVector, outputVector, inputRows);
        }
        
        result.setRowCount(inputRows);
        
        long executionTime = System.currentTimeMillis() - startTime;
        this.stats = new OperatorStats(inputRows, inputRows, executionTime, 
            selectedColumns.size() * inputRows * 8);
        
        return result;
    }
    
    private void copyVector(FieldVector input, FieldVector output, int rowCount) {
        // Use Arrow's built-in transfer functionality for efficient copying
        for (int i = 0; i < rowCount; i++) {
            if (!input.isNull(i)) {
                output.copyFromSafe(i, i, input);
            }
        }
        output.setValueCount(rowCount);
    }
    
    @Override
    public String getOperatorName() {
        return "ProjectOperator[" + String.join(", ", selectedColumns) + "]";
    }
    
    @Override
    public OperatorStats getStats() {
        return stats;
    }
    
    @Override
    public void close() {
        // No resources to clean up
    }
}