package com.minicloud.controlplane.storage;

import org.apache.arrow.memory.BufferAllocator;
import org.apache.arrow.vector.VectorSchemaRoot;
import org.apache.arrow.vector.types.pojo.Schema;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.fs.Path;
import org.apache.parquet.hadoop.ParquetWriter;
import org.apache.parquet.hadoop.metadata.CompressionCodecName;
import org.apache.parquet.hadoop.example.GroupWriteSupport;
import org.apache.parquet.example.data.Group;
import org.apache.parquet.example.data.simple.SimpleGroupFactory;
import org.apache.parquet.schema.MessageType;
import org.apache.parquet.schema.MessageTypeParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.FileReader;
import java.io.IOException;
import java.nio.file.Paths;
import java.util.List;

/**
 * Converts CSV files to Parquet format using Arrow for efficient columnar storage.
 * Supports automatic schema inference and configurable compression.
 */
@Component
public class CsvToParquetConverter {
    
    private static final Logger logger = LoggerFactory.getLogger(CsvToParquetConverter.class);
    
    private final BufferAllocator allocator;
    private final SchemaInferenceService schemaInferenceService;
    
    public CsvToParquetConverter(BufferAllocator allocator, SchemaInferenceService schemaInferenceService) {
        this.allocator = allocator;
        this.schemaInferenceService = schemaInferenceService;
    }
    
    /**
     * Converts a CSV file to Parquet format.
     * 
     * @param csvFilePath Path to the input CSV file
     * @param parquetFilePath Path for the output Parquet file
     * @param hasHeader Whether the CSV file has a header row
     * @return ConversionResult with statistics about the conversion
     */
    public ConversionResult convertCsvToParquet(String csvFilePath, String parquetFilePath, boolean hasHeader) {
        logger.info("Starting CSV to Parquet conversion: {} -> {}", csvFilePath, parquetFilePath);
        
        long startTime = System.currentTimeMillis();
        long rowCount = 0;
        
        try (FileReader fileReader = new FileReader(csvFilePath)) {
            // Parse CSV and infer schema
            CSVFormat csvFormat = hasHeader ? CSVFormat.DEFAULT.withFirstRecordAsHeader() : CSVFormat.DEFAULT;
            CSVParser csvParser = csvFormat.parse(fileReader);
            
            // Infer schema from first few rows
            Schema arrowSchema = schemaInferenceService.inferSchemaFromCsv(csvParser, hasHeader);
            logger.info("Inferred schema: {}", arrowSchema);
            
            // Reset parser to beginning
            csvParser.close();
            fileReader.close();
            
            // Process the file with the inferred schema
            try (FileReader secondReader = new FileReader(csvFilePath);
                 CSVParser secondParser = csvFormat.parse(secondReader);
                 VectorSchemaRoot root = VectorSchemaRoot.create(arrowSchema, allocator)) {
                
                // Create Parquet schema from Arrow schema
                MessageType parquetSchema = createParquetSchema(arrowSchema);
                
                // Configure Parquet writer
                Configuration hadoopConf = new Configuration();
                GroupWriteSupport.setSchema(parquetSchema, hadoopConf);
                Path outputPath = new Path(parquetFilePath);
                
                ParquetWriter<Group> writer = new org.apache.parquet.hadoop.ParquetWriter<Group>(
                    outputPath,
                    new GroupWriteSupport(),
                    CompressionCodecName.SNAPPY,
                    1024 * 1024, // 1MB row groups
                    1024 * 1024, // 1MB page size
                    512 * 1024,  // 512KB dictionary page size
                    true,        // enable dictionary
                    false,       // disable validation
                    org.apache.parquet.hadoop.ParquetWriter.DEFAULT_WRITER_VERSION,
                    hadoopConf
                );
                
                try {
                    
                    // Process CSV records
                    SimpleGroupFactory groupFactory = new SimpleGroupFactory(parquetSchema);
                    List<CSVRecord> records = secondParser.getRecords();
                    
                    // The CSVFormat.DEFAULT.withFirstRecordAsHeader() already handles the header
                    // so we don't need to manually skip it
                    
                    for (CSVRecord record : records) {
                        Group group = groupFactory.newGroup();
                        
                        // Convert CSV record to Parquet group
                        for (int i = 0; i < Math.min(record.size(), arrowSchema.getFields().size()); i++) {
                            String value = record.get(i);
                            if (value != null && !value.trim().isEmpty()) {
                                String fieldName = sanitizeFieldName(arrowSchema.getFields().get(i).getName());
                                // For simplicity, write all values as strings for now
                                group.add(fieldName, value.trim());
                            }
                        }
                        
                        writer.write(group);
                        rowCount++;
                        
                        if (rowCount % 10000 == 0) {
                            logger.debug("Processed {} rows", rowCount);
                        }
                    }
                } finally {
                    writer.close();
                }
            }
            
            long duration = System.currentTimeMillis() - startTime;
            logger.info("Conversion completed: {} rows in {}ms", rowCount, duration);
            
            return new ConversionResult(
                csvFilePath,
                parquetFilePath,
                rowCount,
                duration,
                Paths.get(parquetFilePath).toFile().length(),
                arrowSchema
            );
            
        } catch (IOException e) {
            logger.error("Failed to convert CSV to Parquet", e);
            throw new StorageException("CSV to Parquet conversion failed", e);
        }
    }
    
    /**
     * Creates a Parquet MessageType schema from an Arrow schema.
     * For simplicity, all fields are treated as optional strings.
     */
    private MessageType createParquetSchema(Schema arrowSchema) {
        StringBuilder schemaBuilder = new StringBuilder();
        schemaBuilder.append("message schema {\n");
        
        for (org.apache.arrow.vector.types.pojo.Field field : arrowSchema.getFields()) {
            // For simplicity, treat all fields as optional binary (string) fields
            // Sanitize field name to be valid Parquet identifier
            String sanitizedName = sanitizeFieldName(field.getName());
            schemaBuilder.append("  optional binary ")
                        .append(sanitizedName)
                        .append(" (UTF8);\n");
        }
        
        schemaBuilder.append("}");
        
        return MessageTypeParser.parseMessageType(schemaBuilder.toString());
    }
    
    /**
     * Sanitizes field names to be valid Parquet identifiers.
     */
    private String sanitizeFieldName(String fieldName) {
        // Replace spaces and special characters with underscores
        return fieldName.replaceAll("[^a-zA-Z0-9_]", "_");
    }
    
    /**
     * Result of a CSV to Parquet conversion operation.
     */
    public static class ConversionResult {
        private final String sourcePath;
        private final String targetPath;
        private final long rowCount;
        private final long durationMs;
        private final long fileSizeBytes;
        private final Schema schema;
        
        public ConversionResult(String sourcePath, String targetPath, long rowCount, 
                              long durationMs, long fileSizeBytes, Schema schema) {
            this.sourcePath = sourcePath;
            this.targetPath = targetPath;
            this.rowCount = rowCount;
            this.durationMs = durationMs;
            this.fileSizeBytes = fileSizeBytes;
            this.schema = schema;
        }
        
        // Getters
        public String getSourcePath() { return sourcePath; }
        public String getTargetPath() { return targetPath; }
        public long getRowCount() { return rowCount; }
        public long getDurationMs() { return durationMs; }
        public long getFileSizeBytes() { return fileSizeBytes; }
        public Schema getSchema() { return schema; }
        
        public double getCompressionRatio() {
            // Estimate original CSV size (rough approximation)
            long estimatedCsvSize = rowCount * 50; // Assume ~50 bytes per row average
            return estimatedCsvSize > 0 ? (double) estimatedCsvSize / fileSizeBytes : 1.0;
        }
        
        @Override
        public String toString() {
            return String.format("ConversionResult{rows=%d, duration=%dms, size=%d bytes, compression=%.2fx}", 
                               rowCount, durationMs, fileSizeBytes, getCompressionRatio());
        }
    }
}