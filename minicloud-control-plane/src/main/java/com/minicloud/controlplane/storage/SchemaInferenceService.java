package com.minicloud.controlplane.storage;

import org.apache.arrow.vector.types.FloatingPointPrecision;
import org.apache.arrow.vector.types.pojo.ArrowType;
import org.apache.arrow.vector.types.pojo.Field;
import org.apache.arrow.vector.types.pojo.FieldType;
import org.apache.arrow.vector.types.pojo.Schema;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Service for inferring Arrow schema from CSV data.
 * Analyzes sample data to determine appropriate data types.
 */
@Service
public class SchemaInferenceService {
    
    private static final Logger logger = LoggerFactory.getLogger(SchemaInferenceService.class);
    
    // Common date patterns to try
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
    
    private static final Pattern INTEGER_PATTERN = Pattern.compile("^-?\\d+$");
    private static final Pattern DECIMAL_PATTERN = Pattern.compile("^-?\\d*\\.\\d+$");
    private static final Pattern BOOLEAN_PATTERN = Pattern.compile("^(true|false|yes|no|1|0)$", Pattern.CASE_INSENSITIVE);
    
    /**
     * Infers Arrow schema from CSV data by analyzing sample rows.
     */
    public Schema inferSchemaFromCsv(CSVParser csvParser, boolean hasHeader) {
        List<CSVRecord> records = new ArrayList<>();
        
        // Collect sample records for analysis (up to 1000 rows)
        int sampleSize = 0;
        for (CSVRecord record : csvParser) {
            records.add(record);
            sampleSize++;
            if (sampleSize >= 1000) break;
        }
        
        if (records.isEmpty()) {
            // Return a default schema for empty files
            List<Field> defaultFields = List.of(
                new Field("column_0", FieldType.nullable(ArrowType.Utf8.INSTANCE), null)
            );
            return new Schema(defaultFields);
        }
        
        CSVRecord firstRecord = records.get(0);
        int columnCount = firstRecord.size();
        
        List<Field> fields = new ArrayList<>();
        
        for (int i = 0; i < columnCount; i++) {
            String columnName;
            if (hasHeader) {
                // When hasHeader is true, the CSVParser with withFirstRecordAsHeader() 
                // means the first record contains actual data, not headers
                // We need to get column names from the parser's header map
                columnName = csvParser.getHeaderNames() != null && i < csvParser.getHeaderNames().size() 
                    ? csvParser.getHeaderNames().get(i) 
                    : "column_" + i;
            } else {
                columnName = "column_" + i;
            }
            
            ArrowType dataType = inferColumnType(records, i, false); // Always start from first record for type inference
            
            Field field = new Field(columnName, FieldType.nullable(dataType), null);
            fields.add(field);
            
            logger.debug("Inferred column '{}' as type: {}", columnName, dataType);
        }
        
        return new Schema(fields);
    }
    
    /**
     * Infers the data type for a specific column by analyzing sample values.
     */
    private ArrowType inferColumnType(List<CSVRecord> records, int columnIndex, boolean skipFirstRow) {
        // Skip first row if needed (but when using withFirstRecordAsHeader, this is already handled)
        int startRow = skipFirstRow ? 1 : 0;
        
        // Collect non-null, non-empty values for analysis
        List<String> values = new ArrayList<>();
        for (int i = startRow; i < records.size(); i++) {
            CSVRecord record = records.get(i);
            if (columnIndex < record.size()) {
                String value = record.get(columnIndex);
                if (value != null && !value.trim().isEmpty()) {
                    values.add(value.trim());
                }
            }
        }
        
        if (values.isEmpty()) {
            return ArrowType.Utf8.INSTANCE; // Default to string for empty columns
        }
        
        // Try to infer type based on sample values
        return inferTypeFromValues(values);
    }
    
    /**
     * Analyzes a list of string values to determine the most appropriate Arrow type.
     */
    private ArrowType inferTypeFromValues(List<String> values) {
        int totalValues = values.size();
        int integerCount = 0;
        int decimalCount = 0;
        int booleanCount = 0;
        int dateCount = 0;
        int datetimeCount = 0;
        
        // Analyze each value
        for (String value : values) {
            if (INTEGER_PATTERN.matcher(value).matches()) {
                integerCount++;
            } else if (DECIMAL_PATTERN.matcher(value).matches()) {
                decimalCount++;
            } else if (BOOLEAN_PATTERN.matcher(value).matches()) {
                booleanCount++;
            } else if (isDate(value)) {
                dateCount++;
            } else if (isDateTime(value)) {
                datetimeCount++;
            }
        }
        
        // Determine type based on majority (80% threshold)
        double threshold = 0.8;
        
        if ((double) booleanCount / totalValues >= threshold) {
            return ArrowType.Bool.INSTANCE;
        }
        
        if ((double) datetimeCount / totalValues >= threshold) {
            return new ArrowType.Timestamp(org.apache.arrow.vector.types.TimeUnit.MILLISECOND, null);
        }
        
        if ((double) dateCount / totalValues >= threshold) {
            return new ArrowType.Date(org.apache.arrow.vector.types.DateUnit.DAY);
        }
        
        if ((double) integerCount / totalValues >= threshold) {
            // Check if values fit in different integer types
            boolean fitsInInt = values.stream().allMatch(this::fitsInInteger);
            return fitsInInt ? new ArrowType.Int(32, true) : new ArrowType.Int(64, true);
        }
        
        if ((double) (integerCount + decimalCount) / totalValues >= threshold) {
            return new ArrowType.FloatingPoint(FloatingPointPrecision.DOUBLE);
        }
        
        // Default to string
        return ArrowType.Utf8.INSTANCE;
    }
    
    private boolean isDate(String value) {
        for (DateTimeFormatter formatter : DATE_FORMATTERS) {
            try {
                LocalDate.parse(value, formatter);
                return true;
            } catch (DateTimeParseException e) {
                // Try next formatter
            }
        }
        return false;
    }
    
    private boolean isDateTime(String value) {
        for (DateTimeFormatter formatter : DATETIME_FORMATTERS) {
            try {
                LocalDateTime.parse(value, formatter);
                return true;
            } catch (DateTimeParseException e) {
                // Try next formatter
            }
        }
        return false;
    }
    
    private boolean fitsInInteger(String value) {
        try {
            Integer.parseInt(value);
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }
}