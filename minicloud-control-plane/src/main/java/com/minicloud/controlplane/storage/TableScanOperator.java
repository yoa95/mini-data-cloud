package com.minicloud.controlplane.storage;

import com.minicloud.controlplane.model.TableMetadata;
import org.apache.arrow.memory.BufferAllocator;
import org.apache.arrow.vector.VectorSchemaRoot;
import org.apache.arrow.vector.types.pojo.Schema;
import org.apache.parquet.filter2.predicate.FilterPredicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Table scan operator that reads data from Parquet files with support for:
 * - Column projection (selecting specific columns)
 * - Predicate pushdown (filtering at storage level)
 * - Multi-file scanning for partitioned tables
 * - Integration with Arrow for efficient processing
 */
@Component
public class TableScanOperator {
    
    private static final Logger logger = LoggerFactory.getLogger(TableScanOperator.class);
    
    private final ParquetReader parquetReader;
    private final BufferAllocator allocator;
    
    public TableScanOperator(ParquetReader parquetReader, BufferAllocator allocator) {
        this.parquetReader = parquetReader;
        this.allocator = allocator;
    }
    
    /**
     * Performs a table scan with optional column projection and filtering.
     * 
     * @param tableMetadata Metadata about the table to scan
     * @param scanOptions Configuration for the scan operation
     * @return ScanResult containing the scanned data and statistics
     */
    public ScanResult scanTable(TableMetadata tableMetadata, ScanOptions scanOptions) {
        logger.info("Starting table scan for table: {} with options: {}", 
                   tableMetadata.getTableName(), scanOptions);
        
        long startTime = System.currentTimeMillis();
        
        // Find all data files for the table
        List<String> dataFiles = findDataFiles(tableMetadata);
        logger.debug("Found {} data files for table {}", dataFiles.size(), tableMetadata.getTableName());
        
        if (dataFiles.isEmpty()) {
            logger.warn("No data files found for table: {}", tableMetadata.getTableName());
            return createEmptyScanResult(tableMetadata, startTime);
        }
        
        // Scan all files and combine results
        List<VectorSchemaRoot> batches = new ArrayList<>();
        long totalRows = 0;
        long totalBytes = 0;
        Schema resultSchema = null;
        
        for (String filePath : dataFiles) {
            try {
                logger.debug("Scanning file: {}", filePath);
                
                ParquetReader.ParquetReadResult fileResult = parquetReader.readParquetFile(
                    filePath,
                    scanOptions.getSelectedColumns(),
                    scanOptions.getFilterPredicate()
                );
                
                if (resultSchema == null) {
                    resultSchema = fileResult.getSchema();
                }
                
                batches.add(fileResult.getData());
                totalRows += fileResult.getRowCount();
                totalBytes += fileResult.getBytesRead();
                
                logger.debug("File {} contributed {} rows", filePath, fileResult.getRowCount());
                
            } catch (Exception e) {
                logger.error("Failed to scan file: {}", filePath, e);
                // Continue with other files, but log the error
            }
        }
        
        // Combine all batches into a single result
        VectorSchemaRoot combinedResult = combineBatches(batches, resultSchema);
        
        long duration = System.currentTimeMillis() - startTime;
        
        ScanResult result = new ScanResult(
            combinedResult,
            resultSchema,
            totalRows,
            totalBytes,
            duration,
            dataFiles.size(),
            scanOptions
        );
        
        logger.info("Table scan completed: {}", result);
        return result;
    }
    
    /**
     * Scans a single Parquet file (convenience method).
     */
    public ScanResult scanFile(String filePath, ScanOptions scanOptions) {
        logger.info("Scanning single file: {} with options: {}", filePath, scanOptions);
        
        long startTime = System.currentTimeMillis();
        
        try {
            ParquetReader.ParquetReadResult fileResult = parquetReader.readParquetFile(
                filePath,
                scanOptions.getSelectedColumns(),
                scanOptions.getFilterPredicate()
            );
            
            long duration = System.currentTimeMillis() - startTime;
            
            return new ScanResult(
                fileResult.getData(),
                fileResult.getSchema(),
                fileResult.getRowCount(),
                fileResult.getBytesRead(),
                duration,
                1,
                scanOptions
            );
            
        } catch (Exception e) {
            logger.error("Failed to scan file: {}", filePath, e);
            throw new StorageException("File scan failed", e);
        }
    }
    
    /**
     * Gets metadata for a table without reading the actual data.
     */
    public TableScanMetadata getTableMetadata(TableMetadata tableMetadata) {
        List<String> dataFiles = findDataFiles(tableMetadata);
        
        if (dataFiles.isEmpty()) {
            return new TableScanMetadata(tableMetadata.getTableName(), 0, 0, 0, null);
        }
        
        // Read metadata from first file to get schema
        ParquetReader.ParquetFileMetadata firstFileMetadata = parquetReader.readMetadata(dataFiles.get(0));
        
        // Aggregate statistics from all files
        long totalRows = 0;
        long totalSize = 0;
        
        for (String filePath : dataFiles) {
            ParquetReader.ParquetFileMetadata fileMetadata = parquetReader.readMetadata(filePath);
            totalRows += fileMetadata.getRowCount();
            totalSize += fileMetadata.getFileSize();
        }
        
        return new TableScanMetadata(
            tableMetadata.getTableName(),
            totalRows,
            totalSize,
            dataFiles.size(),
            firstFileMetadata.getSchema()
        );
    }
    
    /**
     * Finds all data files for a given table.
     */
    private List<String> findDataFiles(TableMetadata tableMetadata) {
        List<String> dataFiles = new ArrayList<>();
        
        // Get the table location from metadata
        String tableLocation = tableMetadata.getTableLocation();
        if (tableLocation == null || tableLocation.isEmpty()) {
            logger.warn("Table {} has no location specified", tableMetadata.getTableName());
            return dataFiles;
        }
        
        Path tablePath = Paths.get(tableLocation);
        File tableDir = tablePath.toFile();
        
        if (!tableDir.exists() || !tableDir.isDirectory()) {
            logger.warn("Table directory does not exist: {}", tableLocation);
            return dataFiles;
        }
        
        // Find all .parquet files in the directory (and subdirectories)
        findParquetFiles(tableDir, dataFiles);
        
        return dataFiles;
    }
    
    /**
     * Recursively finds all .parquet files in a directory.
     */
    private void findParquetFiles(File directory, List<String> result) {
        File[] files = directory.listFiles();
        if (files == null) return;
        
        for (File file : files) {
            if (file.isDirectory()) {
                findParquetFiles(file, result);
            } else if (file.getName().toLowerCase().endsWith(".parquet")) {
                result.add(file.getAbsolutePath());
            }
        }
    }
    
    /**
     * Combines multiple VectorSchemaRoot batches into a single result.
     */
    private VectorSchemaRoot combineBatches(List<VectorSchemaRoot> batches, Schema schema) {
        if (batches.isEmpty()) {
            return VectorSchemaRoot.create(schema, allocator);
        }
        
        if (batches.size() == 1) {
            return batches.get(0);
        }
        
        // For now, return the first batch
        // In a full implementation, this would concatenate all batches
        logger.warn("Batch combination not fully implemented, returning first batch only");
        return batches.get(0);
    }
    
    /**
     * Creates an empty scan result for tables with no data.
     */
    private ScanResult createEmptyScanResult(TableMetadata tableMetadata, long startTime) {
        long duration = System.currentTimeMillis() - startTime;
        
        // Create empty schema - in practice, this would come from table metadata
        Schema emptySchema = new Schema(List.of());
        VectorSchemaRoot emptyRoot = VectorSchemaRoot.create(emptySchema, allocator);
        
        return new ScanResult(
            emptyRoot,
            emptySchema,
            0,
            0,
            duration,
            0,
            new ScanOptions()
        );
    }
    
    /**
     * Configuration options for table scanning.
     */
    public static class ScanOptions {
        private Set<String> selectedColumns;
        private FilterPredicate filterPredicate;
        private int batchSize = 1000;
        private boolean enablePredicatePushdown = true;
        private boolean enableColumnPruning = true;
        
        public ScanOptions() {}
        
        public ScanOptions(Set<String> selectedColumns, FilterPredicate filterPredicate) {
            this.selectedColumns = selectedColumns;
            this.filterPredicate = filterPredicate;
        }
        
        // Getters and setters
        public Set<String> getSelectedColumns() { return selectedColumns; }
        public void setSelectedColumns(Set<String> selectedColumns) { this.selectedColumns = selectedColumns; }
        
        public FilterPredicate getFilterPredicate() { return filterPredicate; }
        public void setFilterPredicate(FilterPredicate filterPredicate) { this.filterPredicate = filterPredicate; }
        
        public int getBatchSize() { return batchSize; }
        public void setBatchSize(int batchSize) { this.batchSize = batchSize; }
        
        public boolean isEnablePredicatePushdown() { return enablePredicatePushdown; }
        public void setEnablePredicatePushdown(boolean enablePredicatePushdown) { 
            this.enablePredicatePushdown = enablePredicatePushdown; 
        }
        
        public boolean isEnableColumnPruning() { return enableColumnPruning; }
        public void setEnableColumnPruning(boolean enableColumnPruning) { 
            this.enableColumnPruning = enableColumnPruning; 
        }
        
        @Override
        public String toString() {
            return String.format("ScanOptions{columns=%s, hasFilter=%s, batchSize=%d}", 
                               selectedColumns != null ? selectedColumns.size() + " cols" : "all",
                               filterPredicate != null,
                               batchSize);
        }
    }
    
    /**
     * Result of a table scan operation.
     */
    public static class ScanResult {
        private final VectorSchemaRoot data;
        private final Schema schema;
        private final long rowCount;
        private final long bytesRead;
        private final long durationMs;
        private final int filesScanned;
        private final ScanOptions scanOptions;
        
        public ScanResult(VectorSchemaRoot data, Schema schema, long rowCount, 
                         long bytesRead, long durationMs, int filesScanned, ScanOptions scanOptions) {
            this.data = data;
            this.schema = schema;
            this.rowCount = rowCount;
            this.bytesRead = bytesRead;
            this.durationMs = durationMs;
            this.filesScanned = filesScanned;
            this.scanOptions = scanOptions;
        }
        
        // Getters
        public VectorSchemaRoot getData() { return data; }
        public Schema getSchema() { return schema; }
        public long getRowCount() { return rowCount; }
        public long getBytesRead() { return bytesRead; }
        public long getDurationMs() { return durationMs; }
        public int getFilesScanned() { return filesScanned; }
        public ScanOptions getScanOptions() { return scanOptions; }
        
        public double getThroughputMBps() {
            return durationMs > 0 ? (bytesRead / 1024.0 / 1024.0) / (durationMs / 1000.0) : 0;
        }
        
        public List<String> getColumnNames() {
            return schema.getFields().stream()
                .map(field -> field.getName())
                .collect(Collectors.toList());
        }
        
        @Override
        public String toString() {
            return String.format("ScanResult{rows=%d, files=%d, bytes=%d, duration=%dms, throughput=%.2f MB/s}", 
                               rowCount, filesScanned, bytesRead, durationMs, getThroughputMBps());
        }
    }
    
    /**
     * Metadata about a table for scanning purposes.
     */
    public static class TableScanMetadata {
        private final String tableName;
        private final long totalRows;
        private final long totalSize;
        private final int fileCount;
        private final org.apache.parquet.schema.MessageType schema;
        
        public TableScanMetadata(String tableName, long totalRows, long totalSize, 
                               int fileCount, org.apache.parquet.schema.MessageType schema) {
            this.tableName = tableName;
            this.totalRows = totalRows;
            this.totalSize = totalSize;
            this.fileCount = fileCount;
            this.schema = schema;
        }
        
        // Getters
        public String getTableName() { return tableName; }
        public long getTotalRows() { return totalRows; }
        public long getTotalSize() { return totalSize; }
        public int getFileCount() { return fileCount; }
        public org.apache.parquet.schema.MessageType getSchema() { return schema; }
        
        @Override
        public String toString() {
            return String.format("TableScanMetadata{table='%s', rows=%d, size=%d bytes, files=%d}", 
                               tableName, totalRows, totalSize, fileCount);
        }
    }
}