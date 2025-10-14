package com.minicloud.controlplane.execution;

import org.apache.arrow.memory.BufferAllocator;
import org.apache.arrow.vector.VectorSchemaRoot;
import org.apache.arrow.vector.types.pojo.Schema;
import org.apache.arrow.vector.types.pojo.Field;
import org.apache.arrow.vector.types.pojo.ArrowType;
import org.apache.arrow.vector.BigIntVector;
import org.apache.arrow.vector.VarCharVector;
import org.apache.arrow.vector.Float8Vector;

import java.util.List;
import java.util.ArrayList;

/**
 * Scan operator that reads data and produces Arrow vectors.
 * This is a simplified implementation that creates sample data for demonstration.
 */
public class ScanOperator implements VectorizedOperator {
    
    private final String tableName;
    private final List<String> columnNames;
    private final int rowCount;
    private OperatorStats stats;
    
    public ScanOperator(String tableName, List<String> columnNames, int rowCount) {
        this.tableName = tableName;
        this.columnNames = columnNames;
        this.rowCount = rowCount;
    }
    
    @Override
    public VectorSchemaRoot execute(VectorSchemaRoot input, BufferAllocator allocator) {
        long startTime = System.currentTimeMillis();
        
        // Create schema based on column names (simplified - assumes mixed types)
        List<Field> fields = new ArrayList<>();
        for (String columnName : columnNames) {
            if (columnName.toLowerCase().contains("id")) {
                fields.add(Field.nullable(columnName, new ArrowType.Int(64, true)));
            } else if (columnName.toLowerCase().contains("amount") || columnName.toLowerCase().contains("price")) {
                fields.add(Field.nullable(columnName, ArrowType.Utf8.INSTANCE));
            } else {
                fields.add(Field.nullable(columnName, new ArrowType.Utf8()));
            }
        }
        
        Schema schema = new Schema(fields);
        VectorSchemaRoot result = VectorSchemaRoot.create(schema, allocator);
        
        // Allocate vectors
        result.allocateNew();
        
        // Generate sample data
        for (int i = 0; i < fields.size(); i++) {
            Field field = fields.get(i);
            String fieldName = field.getName();
            
            if (field.getType() instanceof ArrowType.Int) {
                BigIntVector vector = (BigIntVector) result.getVector(i);
                for (int row = 0; row < rowCount; row++) {
                    vector.set(row, row + 1);
                }
                vector.setValueCount(rowCount);
            } else if (field.getType() instanceof ArrowType.Utf8 && fieldName.toLowerCase().contains("amount")) {
                VarCharVector vector = (VarCharVector) result.getVector(i);
                for (int row = 0; row < rowCount; row++) {
                    String value = String.valueOf((row + 1) * 10.5);
                    vector.setSafe(row, value.getBytes());
                }
                vector.setValueCount(rowCount);
            } else {
                VarCharVector vector = (VarCharVector) result.getVector(i);
                for (int row = 0; row < rowCount; row++) {
                    String value = fieldName + "_value_" + (row + 1);
                    vector.setSafe(row, value.getBytes());
                }
                vector.setValueCount(rowCount);
            }
        }
        
        result.setRowCount(rowCount);
        
        long executionTime = System.currentTimeMillis() - startTime;
        this.stats = new OperatorStats(0, rowCount, executionTime, result.getSchema().getFields().size() * rowCount * 8);
        
        return result;
    }
    
    @Override
    public String getOperatorName() {
        return "ScanOperator[" + tableName + "]";
    }
    
    @Override
    public OperatorStats getStats() {
        return stats;
    }
    
    @Override
    public void close() {
        // No resources to clean up in this simple implementation
    }
}