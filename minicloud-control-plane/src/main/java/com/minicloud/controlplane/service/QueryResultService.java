package com.minicloud.controlplane.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.*;

/**
 * Service for storing and retrieving query results
 */
@Service
public class QueryResultService {
    
    private static final Logger logger = LoggerFactory.getLogger(QueryResultService.class);
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String resultsDirectory = "./query-results";
    
    @Autowired
    private ParquetQueryService parquetQueryService;
    
    public QueryResultService() {
        // Create results directory if it doesn't exist
        try {
            Files.createDirectories(Paths.get(resultsDirectory));
        } catch (IOException e) {
            logger.error("Failed to create results directory", e);
        }
    }
    
    /**
     * Store query results
     */
    public String storeResults(String queryId, QueryResult result) {
        try {
            String fileName = queryId + ".json";
            String filePath = Paths.get(resultsDirectory, fileName).toString();
            
            objectMapper.writeValue(new File(filePath), result);
            
            logger.info("Stored results for query {} at {}", queryId, filePath);
            return filePath;
            
        } catch (IOException e) {
            logger.error("Failed to store results for query {}", queryId, e);
            return null;
        }
    }
    
    /**
     * Retrieve query results
     */
    public QueryResult getResults(String queryId) {
        try {
            String fileName = queryId + ".json";
            String filePath = Paths.get(resultsDirectory, fileName).toString();
            
            File file = new File(filePath);
            if (!file.exists()) {
                logger.warn("Results file not found for query {}", queryId);
                return null;
            }
            
            QueryResult result = objectMapper.readValue(file, QueryResult.class);
            logger.debug("Retrieved results for query {}", queryId);
            return result;
            
        } catch (IOException e) {
            logger.error("Failed to retrieve results for query {}", queryId, e);
            return null;
        }
    }
    
    /**
     * Check if results exist for a query
     */
    public boolean hasResults(String queryId) {
        String fileName = queryId + ".json";
        String filePath = Paths.get(resultsDirectory, fileName).toString();
        return new File(filePath).exists();
    }
    
    /**
     * Generate mock results based on SQL query
     */
    public QueryResult generateMockResults(String sql, long rowCount) {
        sql = sql.toLowerCase();
        
        if (sql.contains("count(*)")) {
            // For COUNT(*) queries - get actual count from Parquet files
            long actualCount = parquetQueryService.countTableRows("bank_transactions");
            return new QueryResult(
                Arrays.asList("count"),
                Arrays.asList(
                    Arrays.asList(String.valueOf(actualCount))
                ),
                1,
                "Aggregation result (from Parquet file)"
            );
        } else if (sql.contains("group by category")) {
            // For GROUP BY category queries
            return new QueryResult(
                Arrays.asList("category", "count"),
                Arrays.asList(
                    Arrays.asList("Food & Dining", "4"),
                    Arrays.asList("Income", "2"),
                    Arrays.asList("Transportation", "2"),
                    Arrays.asList("Shopping", "2"),
                    Arrays.asList("Entertainment", "1"),
                    Arrays.asList("Healthcare", "1"),
                    Arrays.asList("Utilities", "1"),
                    Arrays.asList("Cash", "1"),
                    Arrays.asList("Health & Fitness", "1")
                ),
                9,
                "GROUP BY results"
            );
        } else if (sql.contains("select *") || sql.contains("limit")) {
            // For SELECT * queries - read actual data from Parquet files
            int limitValue = parseLimitFromSql(sql);
            
            // Read actual data from Parquet files
            List<List<String>> resultRows = parquetQueryService.readTableData("bank_transactions", limitValue);
            
            String description;
            if (limitValue > 0) {
                description = "SELECT results with LIMIT " + limitValue + " (from Parquet file)";
            } else {
                description = "SELECT all rows (" + resultRows.size() + " total) (from Parquet file)";
            }
            
            return new QueryResult(
                Arrays.asList("id", "date", "description", "category", "amount", "balance"),
                resultRows,
                resultRows.size(),
                description
            );
        } else {
            // Default result
            return new QueryResult(
                Arrays.asList("result"),
                Arrays.asList(
                    Arrays.asList("Query executed successfully")
                ),
                1,
                "Generic query result"
            );
        }
    }
    
    /**
     * Parse LIMIT value from SQL query
     */
    private int parseLimitFromSql(String sql) {
        try {
            // Look for "limit X" pattern
            String[] parts = sql.split("\\s+");
            for (int i = 0; i < parts.length - 1; i++) {
                if ("limit".equals(parts[i].toLowerCase())) {
                    return Integer.parseInt(parts[i + 1]);
                }
            }
            return -1; // No limit found
        } catch (Exception e) {
            logger.warn("Could not parse LIMIT from SQL: {}", sql);
            return -1;
        }
    }
    
    /**
     * Generate all 15 bank transaction rows from the sample data
     */
    private List<List<String>> generateAllBankTransactionRows() {
        return Arrays.asList(
            Arrays.asList("1", "2024-01-15", "Coffee Shop Purchase", "Food & Dining", "-4.50", "1245.50"),
            Arrays.asList("2", "2024-01-15", "Salary Deposit", "Income", "2500.00", "3745.50"),
            Arrays.asList("3", "2024-01-16", "Gas Station", "Transportation", "-45.20", "3700.30"),
            Arrays.asList("4", "2024-01-16", "Grocery Store", "Food & Dining", "-87.65", "3612.65"),
            Arrays.asList("5", "2024-01-17", "Online Shopping", "Shopping", "-129.99", "3482.66"),
            Arrays.asList("6", "2024-01-17", "ATM Withdrawal", "Cash", "-100.00", "3382.66"),
            Arrays.asList("7", "2024-01-18", "Restaurant", "Food & Dining", "-32.75", "3349.91"),
            Arrays.asList("8", "2024-01-18", "Movie Theater", "Entertainment", "-24.00", "3325.91"),
            Arrays.asList("9", "2024-01-19", "Pharmacy", "Healthcare", "-15.80", "3310.11"),
            Arrays.asList("10", "2024-01-19", "Electric Bill", "Utilities", "-89.45", "3220.66"),
            Arrays.asList("11", "2024-01-20", "Freelance Payment", "Income", "750.00", "3970.66"),
            Arrays.asList("12", "2024-01-20", "Gas Station", "Transportation", "-38.90", "3931.76"),
            Arrays.asList("13", "2024-01-21", "Coffee Shop Purchase", "Food & Dining", "-5.25", "3926.51"),
            Arrays.asList("14", "2024-01-21", "Bookstore", "Shopping", "-42.30", "3884.21"),
            Arrays.asList("15", "2024-01-22", "Gym Membership", "Health & Fitness", "-49.99", "3834.22")
        );
    }
    
    /**
     * Query result data structure
     */
    public static class QueryResult {
        private List<String> columns;
        private List<List<String>> rows;
        private long totalRows;
        private String description;
        
        // Default constructor for Jackson
        public QueryResult() {}
        
        public QueryResult(List<String> columns, List<List<String>> rows, long totalRows, String description) {
            this.columns = columns;
            this.rows = rows;
            this.totalRows = totalRows;
            this.description = description;
        }
        
        // Getters and setters
        public List<String> getColumns() { return columns; }
        public void setColumns(List<String> columns) { this.columns = columns; }
        
        public List<List<String>> getRows() { return rows; }
        public void setRows(List<List<String>> rows) { this.rows = rows; }
        
        public long getTotalRows() { return totalRows; }
        public void setTotalRows(long totalRows) { this.totalRows = totalRows; }
        
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
    }
}