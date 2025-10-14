package com.minicloud.controlplane.storage;

import org.apache.arrow.memory.BufferAllocator;
import org.apache.arrow.memory.RootAllocator;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.io.TempDir;

import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Path;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for Parquet I/O operations and performance
 */
class ParquetIntegrationTest {
    
    @TempDir
    Path tempDir;
    
    private BufferAllocator allocator;
    private SchemaInferenceService schemaInferenceService;
    private CsvToParquetConverter converter;
    private ParquetReader parquetReader;
    
    @BeforeEach
    void setUp() {
        allocator = new RootAllocator(1024 * 1024 * 100); // 100MB for tests
        schemaInferenceService = new SchemaInferenceService();
        converter = new CsvToParquetConverter(allocator, schemaInferenceService);
        parquetReader = new ParquetReader(allocator);
    }
    
    @AfterEach
    void tearDown() {
        if (allocator != null) {
            allocator.close();
        }
    }
    
    @Test
    @DisplayName("Test complete CSV to Parquet conversion and reading")
    void testCompleteConversionAndReading() throws IOException {
        // Create sample CSV file
        Path csvFile = createSampleCsvFile("test_data.csv");
        Path parquetFile = tempDir.resolve("test_data.parquet");
        
        // Convert CSV to Parquet
        CsvToParquetConverter.ConversionResult conversionResult = 
            converter.convertCsvToParquet(csvFile.toString(), parquetFile.toString(), true);
        
        assertNotNull(conversionResult);
        assertTrue(conversionResult.getRowCount() > 0);
        assertTrue(conversionResult.getFileSizeBytes() > 0);
        assertTrue(parquetFile.toFile().exists());
        
        // Read Parquet metadata
        ParquetReader.ParquetFileMetadata metadata = parquetReader.readMetadata(parquetFile.toString());
        
        assertNotNull(metadata);
        assertEquals(conversionResult.getRowCount(), metadata.getRowCount());
        assertTrue(metadata.getFileSize() > 0);
        assertNotNull(metadata.getSchema());
        
        System.out.println("Conversion result: " + conversionResult);
        System.out.println("Parquet metadata: " + metadata);
    }
    
    @Test
    @DisplayName("Test Parquet reading with column selection")
    void testParquetReadingWithColumnSelection() throws IOException {
        Path csvFile = createSampleCsvFile("column_test.csv");
        Path parquetFile = tempDir.resolve("column_test.parquet");
        
        // Convert to Parquet
        converter.convertCsvToParquet(csvFile.toString(), parquetFile.toString(), true);
        
        // Read with all columns
        ParquetReader.ParquetReadResult allColumnsResult = 
            parquetReader.readParquetFile(parquetFile.toString(), null, null);
        
        // Read with selected columns
        Set<String> selectedColumns = Set.of("id", "name");
        ParquetReader.ParquetReadResult selectedResult = 
            parquetReader.readParquetFile(parquetFile.toString(), selectedColumns, null);
        
        assertNotNull(allColumnsResult);
        assertNotNull(selectedResult);
        
        // Both should have the same row count
        assertEquals(allColumnsResult.getRowCount(), selectedResult.getRowCount());
        
        // Selected columns result should have fewer fields in schema
        assertTrue(selectedResult.getSchema().getFields().size() <= 
                  allColumnsResult.getSchema().getFields().size());
        
        System.out.println("All columns result: " + allColumnsResult);
        System.out.println("Selected columns result: " + selectedResult);
    }
    
    @Test
    @DisplayName("Test Parquet I/O performance with larger dataset")
    void testParquetPerformance() throws IOException {
        // Create a larger CSV file for performance testing
        Path largeCsvFile = createLargeCsvFile("performance_test.csv", 5000);
        Path parquetFile = tempDir.resolve("performance_test.parquet");
        
        // Measure conversion performance
        long conversionStart = System.currentTimeMillis();
        CsvToParquetConverter.ConversionResult conversionResult = 
            converter.convertCsvToParquet(largeCsvFile.toString(), parquetFile.toString(), true);
        long conversionTime = System.currentTimeMillis() - conversionStart;
        
        // Measure reading performance
        long readStart = System.currentTimeMillis();
        ParquetReader.ParquetReadResult readResult = 
            parquetReader.readParquetFile(parquetFile.toString(), null, null);
        long readTime = System.currentTimeMillis() - readStart;
        
        // Verify results
        assertEquals(5000, conversionResult.getRowCount());
        assertEquals(5000, readResult.getRowCount());
        
        // Performance assertions
        assertTrue(conversionTime < 10000, 
            "Converting 5K rows should complete within 10 seconds, took: " + conversionTime + "ms");
        assertTrue(readTime < 3000, 
            "Reading 5K rows should complete within 3 seconds, took: " + readTime + "ms");
        
        // Compression efficiency
        long csvSize = largeCsvFile.toFile().length();
        long parquetSize = parquetFile.toFile().length();
        double compressionRatio = (double) parquetSize / csvSize;
        
        assertTrue(compressionRatio < 0.8, 
            "Should achieve reasonable compression, got: " + String.format("%.2f%%", compressionRatio * 100));
        
        System.out.println("Performance Test Results:");
        System.out.println("  Rows: " + conversionResult.getRowCount());
        System.out.println("  Conversion time: " + conversionTime + "ms");
        System.out.println("  Read time: " + readTime + "ms");
        System.out.println("  CSV size: " + csvSize + " bytes");
        System.out.println("  Parquet size: " + parquetSize + " bytes");
        System.out.println("  Compression ratio: " + String.format("%.2f%%", compressionRatio * 100));
        System.out.println("  Conversion throughput: " + (conversionResult.getRowCount() / (conversionTime / 1000.0)) + " rows/sec");
        System.out.println("  Read throughput: " + readResult.getThroughputMBps() + " MB/s");
    }
    
    @Test
    @DisplayName("Test error handling with invalid files")
    void testErrorHandling() {
        // Test reading non-existent file
        assertThrows(Exception.class, () -> {
            parquetReader.readMetadata("non_existent.parquet");
        });
        
        // Test reading metadata from non-existent file
        assertThrows(Exception.class, () -> {
            parquetReader.readParquetFile("non_existent.parquet", null, null);
        });
    }
    
    @Test
    @DisplayName("Test memory management during Parquet operations")
    void testMemoryManagement() throws IOException {
        long initialMemory = allocator.getAllocatedMemory();
        
        // Perform multiple conversion and read operations
        for (int i = 0; i < 3; i++) {
            Path csvFile = createSampleCsvFile("memory_test_" + i + ".csv");
            Path parquetFile = tempDir.resolve("memory_test_" + i + ".parquet");
            
            // Convert and read
            CsvToParquetConverter.ConversionResult conversionResult = 
                converter.convertCsvToParquet(csvFile.toString(), parquetFile.toString(), true);
            
            ParquetReader.ParquetReadResult readResult = 
                parquetReader.readParquetFile(parquetFile.toString(), null, null);
            
            // Verify operations succeeded
            assertTrue(conversionResult.getRowCount() > 0);
            assertEquals(conversionResult.getRowCount(), readResult.getRowCount());
        }
        
        // Memory should be managed properly
        long finalMemory = allocator.getAllocatedMemory();
        assertTrue(finalMemory <= initialMemory + 5120, // Allow 5KB variance
            "Memory should be properly managed, initial: " + initialMemory + ", final: " + finalMemory);
    }
    
    /**
     * Create a sample CSV file for testing
     */
    private Path createSampleCsvFile(String filename) throws IOException {
        Path csvFile = tempDir.resolve(filename);
        
        try (FileWriter writer = new FileWriter(csvFile.toFile())) {
            writer.write("id,name,age,salary\n");
            writer.write("1,John Doe,30,50000.0\n");
            writer.write("2,Jane Smith,25,45000.0\n");
            writer.write("3,Bob Johnson,35,60000.0\n");
            writer.write("4,Alice Brown,28,52000.0\n");
        }
        
        return csvFile;
    }
    
    /**
     * Create a large CSV file for performance testing
     */
    private Path createLargeCsvFile(String filename, int rowCount) throws IOException {
        Path csvFile = tempDir.resolve(filename);
        
        try (FileWriter writer = new FileWriter(csvFile.toFile())) {
            writer.write("id,name,department,salary,hire_date\n");
            
            String[] departments = {"Engineering", "Sales", "Marketing", "HR", "Finance"};
            
            for (int i = 1; i <= rowCount; i++) {
                String name = "Employee" + i;
                String department = departments[i % departments.length];
                double salary = 40000 + (i % 60000); // Salary range 40K-100K
                String hireDate = "2023-" + String.format("%02d", (i % 12) + 1) + "-01";
                
                writer.write(String.format("%d,%s,%s,%.2f,%s\n", 
                    i, name, department, salary, hireDate));
            }
        }
        
        return csvFile;
    }
}