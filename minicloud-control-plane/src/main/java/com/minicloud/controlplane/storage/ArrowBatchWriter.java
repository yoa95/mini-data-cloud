package com.minicloud.controlplane.storage;

import org.apache.arrow.vector.*;
import org.apache.arrow.vector.types.pojo.ArrowType;
import org.apache.arrow.vector.types.pojo.Field;
import org.apache.arrow.vector.types.pojo.Schema;
import org.apache.commons.csv.CSVRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * Utility class for writing CSV data to Arrow VectorSchemaRoot in batches.
 * Handles type conversion from string values to appropriate Arrow vector types.
 */
public class ArrowBatchWriter {
    
    private static final Logger logger = LoggerFactory.getLogger(ArrowBatchWriter.class);
    
    private final VectorSchemaRoot root;
    private final Schema schema;
    
    // Date formatters for parsing
    private static final List<DateTimeFormatter> DATE_FORMATTERS = List.of(
        DateTimeFormatter.ofPattern("yyyy-MM-dd"),
        DateTimeFormatter.ofPattern("MM/dd/yyyy"),
        DateTimeFormatter.ofPattern("dd/MM/yyyy"),
        DateTimeFormatter.ofPattern("yyyy/MM/dd")
    );
    
    private static final List<DateTimeFormatter> DATETIME_FORMATTERS = List.of(
        DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
        DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss"),
        DateTimeFormatter.ofPattern("MM/dd/yyyy HH:mm:ss"),
        DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")
    );
    
    public ArrowBatchWriter(VectorSchemaRoot root, Schema schema) {
        this.root = root;
        this.schema = schema;
    }
    
    /**
     * Writes a batch of CSV records to the Arrow VectorSchemaRoot.
     */
    public void writeBatch(List<CSVRecord> records) {
        if (records.isEmpty()) {
            return;
        }
        
        int batchSize = records.size();
        root.allocateNew();
        root.setRowCount(batchSize);
        
        // Process each column
        for (int colIndex = 0; colIndex < schema.getFields().size(); colIndex++) {
            Field field = schema.getFields().get(colIndex);
            FieldVector vector = root.getVector(colIndex);
            
            writeColumnData(vector, field, records, colIndex);
        }
    }
    
    /**
     * Writes data for a specific column to its corresponding vector.
     */
    private void writeColumnData(FieldVector vector, Field field, List<CSVRecord> records, int colIndex) {
        ArrowType arrowType = field.getType();
        
        for (int rowIndex = 0; rowIndex < records.size(); rowIndex++) {
            CSVRecord record = records.get(rowIndex);
            String value = colIndex < record.size() ? record.get(colIndex) : null;
            
            if (value == null || value.trim().isEmpty()) {
                vector.setNull(rowIndex);
                continue;
            }
            
            value = value.trim();
            
            try {
                writeValue(vector, arrowType, rowIndex, value);
            } catch (Exception e) {
                logger.warn("Failed to parse value '{}' for column '{}' as type {}, setting to null", 
                           value, field.getName(), arrowType, e);
                vector.setNull(rowIndex);
            }
        }
        
        vector.setValueCount(records.size());
    }
    
    /**
     * Writes a single value to the appropriate vector type.
     */
    private void writeValue(FieldVector vector, ArrowType arrowType, int index, String value) {
        // For now, treat all values as strings to avoid missing vector type issues
        // In a full implementation, this would handle all Arrow types properly
        if (vector instanceof VarCharVector) {
            VarCharVector varCharVector = (VarCharVector) vector;
            varCharVector.setSafe(index, value.getBytes());
        } else {
            // Set as null for unsupported types for now
            vector.setNull(index);
            logger.warn("Unsupported vector type: {}, setting value to null", vector.getClass().getSimpleName());
        }
    }
    
    private boolean parseBoolean(String value) {
        String lower = value.toLowerCase();
        return "true".equals(lower) || "yes".equals(lower) || "1".equals(lower);
    }
    
    private LocalDate parseDate(String value) {
        for (DateTimeFormatter formatter : DATE_FORMATTERS) {
            try {
                return LocalDate.parse(value, formatter);
            } catch (DateTimeParseException e) {
                // Try next formatter
            }
        }
        return null;
    }
    
    private LocalDateTime parseDateTime(String value) {
        for (DateTimeFormatter formatter : DATETIME_FORMATTERS) {
            try {
                return LocalDateTime.parse(value, formatter);
            } catch (DateTimeParseException e) {
                // Try next formatter
            }
        }
        return null;
    }
}