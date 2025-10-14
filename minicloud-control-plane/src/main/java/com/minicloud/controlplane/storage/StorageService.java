package com.minicloud.controlplane.storage;

import com.minicloud.controlplane.model.TableMetadata;
import org.apache.arrow.vector.VectorSchemaRoot;
import org.apache.arrow.vector.types.pojo.Schema;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Set;

/**
 * High-level storage service that provides data loading and querying capabilities.
 * Integrates CSV conversion, Parquet I/O, and table scanning operations.
 */
@Service
public class StorageService {
    
    private static final Logger logger = LoggerFactory.getLogger(StorageService.class);
    
    private final CsvToParquetConverter csvConverter;
    private final ParquetReader parquetReader;
    private final TableScanOperator tableScanOperator;
    
    public StorageService(CsvToParquetConverter csvConverter, 
                         ParquetReader parquetReader,
                         TableScanOperator tableScanOperator) {
        this.csvConverter = csvConverter;
        this.parquetReader = parquetReader;
        this.tableScanOperator = tableScanOperator;
    }
    
    /**
     * Loads data from a CSV file into a table by converting to Parquet format.
     * 
     * @param csvFilePath Path to the source CSV file
     * @param tableName Name of the target table
     * @param tableLocation Directory where Parquet files will be stored
     * @param hasHeader Whether the CSV has a header row
     * @return LoadResult with information about the loaded data
     */
    public LoadResult loadCsvData(String csvFilePath, String tableName, String tableLocation, boolean hasHeader) {
        logger.info("Loading CSV data from {} into table {} at location {}", 
                   csvFilePath, tableName, tableLocation);
        
        // Ensure table directory exists
        File tableDir = Paths.get(tableLocation).toFile();
        if (!tableDir.exists()) {
            boolean created = tableDir.mkdirs();
            if (!created) {
                throw new StorageException("Failed to create table directory: " + tableLocation);
            }
        }
        
        // Generate Parquet file path
        String parquetFileName = tableName + "_" + System.currentTimeMillis() + ".parquet";
        String parquetFilePath = Paths.get(tableLocation, parquetFileName).toString();
        
        // Convert CSV to Parquet
        CsvToParquetConverter.ConversionResult conversionResult = 
            csvConverter.convertCsvToParquet(csvFilePath, parquetFilePath, hasHeader);
        
        logger.info("CSV conversion completed: {}", conversionResult);
        
        return new LoadResult(
            csvFilePath,
            parquetFilePath,
            tableName,
            conversionResult.getRowCount(),
            conversionResult.getFileSizeBytes(),
            conversionResult.getDurationMs(),
            conversionResult.getSchema()
        );
    }
    
    /**
     * Queries a table with optional column selection and filtering.
     * 
     * @param tableMetadata Metadata about the table to query
     * @param selectedColumns Set of column names to select (null for all)
     * @param whereClause Optional WHERE clause for filtering (simplified)
     * @return QueryResult containing the data and execution statistics
     */
    public QueryResult queryTable(TableMetadata tableMetadata, Set<String> selectedColumns, String whereClause) {
        logger.info("Querying table {} with columns {} and filter '{}'", 
                   tableMetadata.getTableName(), selectedColumns, whereClause);
        
        // Create scan options
        TableScanOperator.ScanOptions scanOptions = new TableScanOperator.ScanOptions();
        scanOptions.setSelectedColumns(selectedColumns);
        
        // TODO: Parse whereClause and convert to FilterPredicate
        // For now, we'll skip predicate pushdown and handle filtering in memory
        
        // Perform table scan
        TableScanOperator.ScanResult scanResult = tableScanOperator.scanTable(tableMetadata, scanOptions);
        
        // Apply in-memory filtering if needed
        VectorSchemaRoot filteredData = applyInMemoryFilter(scanResult.getData(), whereClause);
        
        return new QueryResult(
            filteredData,
            scanResult.getSchema(),
            filteredData.getRowCount(),
            scanResult.getBytesRead(),
            scanResult.getDurationMs(),
            scanResult.getFilesScanned(),
            selectedColumns,
            whereClause
        );
    }
    
    /**
     * Gets statistics about a table without loading the data.
     */
    public TableStats getTableStats(TableMetadata tableMetadata) {
        logger.debug("Getting statistics for table: {}", tableMetadata.getTableName());
        
        TableScanOperator.TableScanMetadata scanMetadata = 
            tableScanOperator.getTableMetadata(tableMetadata);
        
        return new TableStats(
            tableMetadata.getTableName(),
            scanMetadata.getTotalRows(),
            scanMetadata.getTotalSize(),
            scanMetadata.getFileCount(),
            scanMetadata.getSchema() != null ? scanMetadata.getSchema().getFieldCount() : 0
        );
    }
    
    /**
     * Validates that a Parquet file can be read successfully.
     */
    public ValidationResult validateParquetFile(String filePath) {
        logger.debug("Validating Parquet file: {}", filePath);
        
        try {
            ParquetReader.ParquetFileMetadata metadata = parquetReader.readMetadata(filePath);
            
            // Try to read a small sample to ensure the file is not corrupted
            TableScanOperator.ScanOptions sampleOptions = new TableScanOperator.ScanOptions();
            sampleOptions.setBatchSize(10); // Read only 10 rows for validation
            
            TableScanOperator.ScanResult sampleResult = tableScanOperator.scanFile(filePath, sampleOptions);
            
            return new ValidationResult(
                true,
                "File is valid",
                metadata.getRowCount(),
                metadata.getFileSize(),
                sampleResult.getColumnNames()
            );
            
        } catch (Exception e) {
            logger.warn("Parquet file validation failed: {}", filePath, e);
            return new ValidationResult(
                false,
                "Validation failed: " + e.getMessage(),
                0,
                0,
                null
            );
        }
    }
    
    /**
     * Applies simple in-memory filtering (placeholder implementation).
     */
    private VectorSchemaRoot applyInMemoryFilter(VectorSchemaRoot data, String whereClause) {
        // For now, return data as-is
        // In a full implementation, this would parse the WHERE clause and apply filters
        if (whereClause == null || whereClause.trim().isEmpty()) {
            return data;
        }
        
        logger.warn("In-memory filtering not yet implemented, returning unfiltered data");
        return data;
    }
    
    /**
     * Result of loading CSV data into a table.
     */
    public static class LoadResult {
        private final String sourcePath;
        private final String targetPath;
        private final String tableName;
        private final long rowCount;
        private final long fileSizeBytes;
        private final long durationMs;
        private final Schema schema;
        
        public LoadResult(String sourcePath, String targetPath, String tableName, 
                         long rowCount, long fileSizeBytes, long durationMs, Schema schema) {
            this.sourcePath = sourcePath;
            this.targetPath = targetPath;
            this.tableName = tableName;
            this.rowCount = rowCount;
            this.fileSizeBytes = fileSizeBytes;
            this.durationMs = durationMs;
            this.schema = schema;
        }
        
        // Getters
        public String getSourcePath() { return sourcePath; }
        public String getTargetPath() { return targetPath; }
        public String getTableName() { return tableName; }
        public long getRowCount() { return rowCount; }
        public long getFileSizeBytes() { return fileSizeBytes; }
        public long getDurationMs() { return durationMs; }
        public Schema getSchema() { return schema; }
        
        @Override
        public String toString() {
            return String.format("LoadResult{table='%s', rows=%d, size=%d bytes, duration=%dms}", 
                               tableName, rowCount, fileSizeBytes, durationMs);
        }
    }
    
    /**
     * Result of querying a table.
     */
    public static class QueryResult {
        private final VectorSchemaRoot data;
        private final Schema schema;
        private final long rowCount;
        private final long bytesRead;
        private final long durationMs;
        private final int filesScanned;
        private final Set<String> selectedColumns;
        private final String whereClause;
        
        public QueryResult(VectorSchemaRoot data, Schema schema, long rowCount, 
                          long bytesRead, long durationMs, int filesScanned,
                          Set<String> selectedColumns, String whereClause) {
            this.data = data;
            this.schema = schema;
            this.rowCount = rowCount;
            this.bytesRead = bytesRead;
            this.durationMs = durationMs;
            this.filesScanned = filesScanned;
            this.selectedColumns = selectedColumns;
            this.whereClause = whereClause;
        }
        
        // Getters
        public VectorSchemaRoot getData() { return data; }
        public Schema getSchema() { return schema; }
        public long getRowCount() { return rowCount; }
        public long getBytesRead() { return bytesRead; }
        public long getDurationMs() { return durationMs; }
        public int getFilesScanned() { return filesScanned; }
        public Set<String> getSelectedColumns() { return selectedColumns; }
        public String getWhereClause() { return whereClause; }
        
        public double getThroughputMBps() {
            return durationMs > 0 ? (bytesRead / 1024.0 / 1024.0) / (durationMs / 1000.0) : 0;
        }
        
        @Override
        public String toString() {
            return String.format("QueryResult{rows=%d, files=%d, duration=%dms, throughput=%.2f MB/s}", 
                               rowCount, filesScanned, durationMs, getThroughputMBps());
        }
    }
    
    /**
     * Statistics about a table.
     */
    public static class TableStats {
        private final String tableName;
        private final long rowCount;
        private final long sizeBytes;
        private final int fileCount;
        private final int columnCount;
        
        public TableStats(String tableName, long rowCount, long sizeBytes, int fileCount, int columnCount) {
            this.tableName = tableName;
            this.rowCount = rowCount;
            this.sizeBytes = sizeBytes;
            this.fileCount = fileCount;
            this.columnCount = columnCount;
        }
        
        // Getters
        public String getTableName() { return tableName; }
        public long getRowCount() { return rowCount; }
        public long getSizeBytes() { return sizeBytes; }
        public int getFileCount() { return fileCount; }
        public int getColumnCount() { return columnCount; }
        
        @Override
        public String toString() {
            return String.format("TableStats{table='%s', rows=%d, size=%d bytes, files=%d, columns=%d}", 
                               tableName, rowCount, sizeBytes, fileCount, columnCount);
        }
    }
    
    /**
     * Result of validating a Parquet file.
     */
    public static class ValidationResult {
        private final boolean valid;
        private final String message;
        private final long rowCount;
        private final long fileSize;
        private final java.util.List<String> columnNames;
        
        public ValidationResult(boolean valid, String message, long rowCount, 
                              long fileSize, java.util.List<String> columnNames) {
            this.valid = valid;
            this.message = message;
            this.rowCount = rowCount;
            this.fileSize = fileSize;
            this.columnNames = columnNames;
        }
        
        // Getters
        public boolean isValid() { return valid; }
        public String getMessage() { return message; }
        public long getRowCount() { return rowCount; }
        public long getFileSize() { return fileSize; }
        public java.util.List<String> getColumnNames() { return columnNames; }
        
        @Override
        public String toString() {
            return String.format("ValidationResult{valid=%s, message='%s', rows=%d}", 
                               valid, message, rowCount);
        }
    }
}