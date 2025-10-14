package com.minicloud.controlplane.storage;

import org.apache.arrow.memory.BufferAllocator;
import org.apache.arrow.memory.RootAllocator;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Test using the sample bank transactions data to verify real-world functionality.
 */
class SampleDataTest {
    
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
    void testSampleBankTransactionsData() throws IOException {
        // Check if sample data file exists
        Path sampleDataPath = Paths.get("../sample-data/bank_transactions.csv");
        if (!Files.exists(sampleDataPath)) {
            // Skip test if sample data doesn't exist
            System.out.println("Sample data file not found, skipping test: " + sampleDataPath);
            return;
        }
        
        // Load the sample bank transactions data
        String tableName = "bank_transactions";
        String tableLocation = tempDir.resolve("bank_data").toString();
        
        StorageService.LoadResult loadResult = storageService.loadCsvData(
            sampleDataPath.toString(),
            tableName,
            tableLocation,
            true // has header
        );
        
        // Verify the load was successful
        assertNotNull(loadResult);
        assertEquals(15, loadResult.getRowCount()); // Should have 15 transaction records
        assertEquals(tableName, loadResult.getTableName());
        assertTrue(loadResult.getFileSizeBytes() > 0);
        assertNotNull(loadResult.getSchema());
        
        System.out.println("Sample data load result: " + loadResult);
        System.out.println("Schema: " + loadResult.getSchema());
        
        // Verify the schema contains expected columns
        String schemaString = loadResult.getSchema().toString();
        assertTrue(schemaString.contains("id"));
        assertTrue(schemaString.contains("date"));
        assertTrue(schemaString.contains("description"));
        assertTrue(schemaString.contains("category"));
        assertTrue(schemaString.contains("amount"));
        assertTrue(schemaString.contains("balance"));
        
        // Verify Parquet file was created and is valid
        StorageService.ValidationResult validation = storageService.validateParquetFile(
            loadResult.getTargetPath()
        );
        
        assertTrue(validation.isValid());
        assertEquals(15, validation.getRowCount());
        assertTrue(validation.getFileSize() > 0);
        assertNotNull(validation.getColumnNames());
        
        // Check that all expected columns are present
        assertTrue(validation.getColumnNames().contains("id"));
        assertTrue(validation.getColumnNames().contains("date"));
        assertTrue(validation.getColumnNames().contains("description"));
        assertTrue(validation.getColumnNames().contains("category"));
        assertTrue(validation.getColumnNames().contains("amount"));
        assertTrue(validation.getColumnNames().contains("balance"));
        
        System.out.println("Sample data validation result: " + validation);
        System.out.println("Column names: " + validation.getColumnNames());
    }
}