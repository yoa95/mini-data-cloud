package com.minicloud.controlplane.storage;

import com.minicloud.controlplane.model.TableMetadata;
import org.apache.arrow.memory.BufferAllocator;
import org.apache.arrow.memory.RootAllocator;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Path;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration test for the complete storage workflow:
 * CSV -> Parquet conversion -> Table scanning -> Querying
 */
class StorageServiceIntegrationTest {
    
    @TempDir
    Path tempDir;
    
    private BufferAllocator allocator;
    private StorageService storageService;
    
    @BeforeEach
    void setUp() {
        allocator = new RootAllocator(1024 * 1024 * 100); // 100MB for tests
        
        // Create storage service with all dependencies
        SchemaInferenceService schemaInferenceService = new SchemaInferenceService();
        CsvToParquetConverter csvConverter = new CsvToParquetConverter(allocator, schemaInferenceService);
        ParquetReader parquetReader = new ParquetReader(allocator);
        TableScanOperator tableScanOperator = new TableScanOperator(parquetReader, allocator);
        
        storageService = new StorageService(csvConverter, parquetReader, tableScanOperator);
    }
    
    @AfterEach
    void tearDown() {
        if (allocator != null) {
            allocator.close();
        }
    }
    
    @Test
    void testCompleteWorkflow() throws IOException {
        // 1. Create sample CSV data
        Path csvFile = tempDir.resolve("transactions.csv");
        try (FileWriter writer = new FileWriter(csvFile.toFile())) {
            writer.write("id,category,amount,date\n");
            writer.write("1,Food,25.50,2023-01-15\n");
            writer.write("2,Transport,12.00,2023-01-16\n");
            writer.write("3,Food,18.75,2023-01-17\n");
            writer.write("4,Entertainment,45.00,2023-01-18\n");
            writer.write("5,Transport,8.50,2023-01-19\n");
        }
        
        // 2. Load CSV data into table
        String tableName = "transactions";
        String tableLocation = tempDir.resolve("table_data").toString();
        
        StorageService.LoadResult loadResult = storageService.loadCsvData(
            csvFile.toString(),
            tableName,
            tableLocation,
            true // has header
        );
        
        // Verify load result
        assertNotNull(loadResult);
        assertEquals(5, loadResult.getRowCount());
        assertEquals(tableName, loadResult.getTableName());
        assertTrue(loadResult.getFileSizeBytes() > 0);
        assertNotNull(loadResult.getSchema());
        
        System.out.println("Load result: " + loadResult);
        
        // 3. Create table metadata
        TableMetadata tableMetadata = new TableMetadata(
            "default",
            tableName,
            tableLocation,
            loadResult.getSchema().toString()
        );
        tableMetadata.setRowCount((long) loadResult.getRowCount());
        tableMetadata.setDataSizeBytes(loadResult.getFileSizeBytes());
        
        // 4. Get table statistics
        StorageService.TableStats stats = storageService.getTableStats(tableMetadata);
        assertNotNull(stats);
        assertEquals(tableName, stats.getTableName());
        assertTrue(stats.getRowCount() > 0);
        assertTrue(stats.getSizeBytes() > 0);
        assertTrue(stats.getFileCount() > 0);
        
        System.out.println("Table stats: " + stats);
        
        // 5. Query all data
        StorageService.QueryResult queryResult = storageService.queryTable(
            tableMetadata,
            null, // all columns
            null  // no filter
        );
        
        assertNotNull(queryResult);
        assertNotNull(queryResult.getData());
        assertNotNull(queryResult.getSchema());
        assertTrue(queryResult.getDurationMs() >= 0);
        
        System.out.println("Query result: " + queryResult);
        
        // 6. Query with column selection
        Set<String> selectedColumns = Set.of("category", "amount");
        StorageService.QueryResult projectedResult = storageService.queryTable(
            tableMetadata,
            selectedColumns,
            null
        );
        
        assertNotNull(projectedResult);
        assertEquals(selectedColumns, projectedResult.getSelectedColumns());
        
        System.out.println("Projected query result: " + projectedResult);
        
        // 7. Validate Parquet file
        StorageService.ValidationResult validation = storageService.validateParquetFile(
            loadResult.getTargetPath()
        );
        
        assertTrue(validation.isValid());
        assertEquals(5, validation.getRowCount());
        assertTrue(validation.getFileSize() > 0);
        assertNotNull(validation.getColumnNames());
        assertTrue(validation.getColumnNames().contains("id"));
        assertTrue(validation.getColumnNames().contains("category"));
        
        System.out.println("Validation result: " + validation);
    }
    
    @Test
    void testEmptyTableHandling() throws IOException {
        // Create empty table directory
        String tableName = "empty_table";
        String tableLocation = tempDir.resolve("empty_table_data").toString();
        
        TableMetadata emptyTableMetadata = new TableMetadata(
            "default",
            tableName,
            tableLocation,
            "empty schema"
        );
        
        // Query empty table should not fail
        StorageService.QueryResult emptyResult = storageService.queryTable(
            emptyTableMetadata,
            null,
            null
        );
        
        assertNotNull(emptyResult);
        assertEquals(0, emptyResult.getRowCount());
        assertEquals(0, emptyResult.getFilesScanned());
        
        System.out.println("Empty table query result: " + emptyResult);
    }
}