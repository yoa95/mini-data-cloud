package com.minicloud.controlplane.storage;

import org.apache.arrow.memory.BufferAllocator;
import org.apache.arrow.memory.RootAllocator;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Test for CSV to Parquet conversion functionality.
 */
class CsvToParquetConverterTest {
    
    @TempDir
    Path tempDir;
    
    private BufferAllocator allocator;
    private SchemaInferenceService schemaInferenceService;
    private CsvToParquetConverter converter;
    
    @BeforeEach
    void setUp() {
        allocator = new RootAllocator(1024 * 1024 * 100); // 100MB for tests
        schemaInferenceService = new SchemaInferenceService();
        converter = new CsvToParquetConverter(allocator, schemaInferenceService);
    }
    
    @AfterEach
    void tearDown() {
        if (allocator != null) {
            allocator.close();
        }
    }
    
    @Test
    void testConvertSimpleCsvToParquet() throws IOException {
        // Create a simple CSV file
        Path csvFile = tempDir.resolve("test.csv");
        Path parquetFile = tempDir.resolve("test.parquet");
        
        try (FileWriter writer = new FileWriter(csvFile.toFile())) {
            writer.write("id,name,age,salary\n");
            writer.write("1,John Doe,30,50000.0\n");
            writer.write("2,Jane Smith,25,45000.0\n");
            writer.write("3,Bob Johnson,35,60000.0\n");
        }
        
        // Convert CSV to Parquet
        CsvToParquetConverter.ConversionResult result = converter.convertCsvToParquet(
            csvFile.toString(),
            parquetFile.toString(),
            true // has header
        );
        
        // Verify conversion result
        assertNotNull(result);
        assertEquals(3, result.getRowCount());
        assertTrue(result.getFileSizeBytes() > 0);
        assertTrue(result.getDurationMs() >= 0);
        assertNotNull(result.getSchema());
        
        // Verify Parquet file was created
        assertTrue(parquetFile.toFile().exists());
        assertTrue(parquetFile.toFile().length() > 0);
        
        System.out.println("Conversion result: " + result);
    }
    
    @Test
    void testConvertCsvWithoutHeader() throws IOException {
        // Create a CSV file without header
        Path csvFile = tempDir.resolve("no_header.csv");
        Path parquetFile = tempDir.resolve("no_header.parquet");
        
        try (FileWriter writer = new FileWriter(csvFile.toFile())) {
            writer.write("1,Alice,28\n");
            writer.write("2,Bob,32\n");
            writer.write("3,Charlie,29\n");
        }
        
        // Convert CSV to Parquet
        CsvToParquetConverter.ConversionResult result = converter.convertCsvToParquet(
            csvFile.toString(),
            parquetFile.toString(),
            false // no header
        );
        
        // Verify conversion result
        assertNotNull(result);
        assertEquals(3, result.getRowCount());
        assertTrue(result.getFileSizeBytes() > 0);
        
        // Verify Parquet file was created
        assertTrue(parquetFile.toFile().exists());
        
        System.out.println("No header conversion result: " + result);
    }
    
    @Test
    void testConvertEmptyCsv() throws IOException {
        // Create an empty CSV file (header only)
        Path csvFile = tempDir.resolve("empty.csv");
        Path parquetFile = tempDir.resolve("empty.parquet");
        
        try (FileWriter writer = new FileWriter(csvFile.toFile())) {
            writer.write("id,name,value\n");
        }
        
        // Convert CSV to Parquet
        CsvToParquetConverter.ConversionResult result = converter.convertCsvToParquet(
            csvFile.toString(),
            parquetFile.toString(),
            true // has header
        );
        
        // Verify conversion result
        assertNotNull(result);
        assertEquals(0, result.getRowCount()); // No data rows
        
        System.out.println("Empty CSV conversion result: " + result);
    }
}