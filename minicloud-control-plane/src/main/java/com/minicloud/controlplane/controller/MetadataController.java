package com.minicloud.controlplane.controller;

import com.minicloud.controlplane.dto.TableInfo;
import com.minicloud.controlplane.service.MetadataService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

/**
 * REST controller for metadata and table registry operations
 */
@RestController
@RequestMapping("/api/v1/metadata")
@CrossOrigin(origins = "*") // For development - should be restricted in production
public class MetadataController {
    
    private static final Logger logger = LoggerFactory.getLogger(MetadataController.class);
    
    @Autowired
    private MetadataService metadataService;
    
    /**
     * List all tables
     */
    @GetMapping("/tables")
    public ResponseEntity<List<TableInfo>> listAllTables() {
        logger.debug("Listing all tables");
        
        try {
            List<TableInfo> tables = metadataService.listAllTables();
            return ResponseEntity.ok(tables);
        } catch (Exception e) {
            logger.error("Error listing tables", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * List tables in a specific namespace
     */
    @GetMapping("/namespaces/{namespaceName}/tables")
    public ResponseEntity<List<TableInfo>> listTablesInNamespace(@PathVariable String namespaceName) {
        logger.debug("Listing tables in namespace: {}", namespaceName);
        
        try {
            List<TableInfo> tables = metadataService.listTables(namespaceName);
            return ResponseEntity.ok(tables);
        } catch (Exception e) {
            logger.error("Error listing tables in namespace: {}", namespaceName, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Get specific table information
     */
    @GetMapping("/namespaces/{namespaceName}/tables/{tableName}")
    public ResponseEntity<TableInfo> getTable(@PathVariable String namespaceName, 
                                            @PathVariable String tableName) {
        logger.debug("Getting table: {}.{}", namespaceName, tableName);
        
        try {
            Optional<TableInfo> table = metadataService.getTable(namespaceName, tableName);
            if (table.isPresent()) {
                return ResponseEntity.ok(table.get());
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            logger.error("Error getting table: {}.{}", namespaceName, tableName, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Register a new table
     */
    @PostMapping("/namespaces/{namespaceName}/tables/{tableName}")
    public ResponseEntity<TableInfo> registerTable(@PathVariable String namespaceName,
                                                 @PathVariable String tableName,
                                                 @RequestBody RegisterTableRequest request) {
        logger.info("Registering table: {}.{}", namespaceName, tableName);
        
        try {
            TableInfo table = metadataService.registerTable(namespaceName, tableName, 
                                                           request.getTableLocation(), 
                                                           request.getSchemaDefinition());
            return ResponseEntity.status(HttpStatus.CREATED).body(table);
        } catch (IllegalArgumentException e) {
            logger.warn("Table registration failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        } catch (Exception e) {
            logger.error("Error registering table: {}.{}", namespaceName, tableName, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Delete a table from registry
     */
    @DeleteMapping("/namespaces/{namespaceName}/tables/{tableName}")
    public ResponseEntity<Void> deleteTable(@PathVariable String namespaceName,
                                          @PathVariable String tableName) {
        logger.info("Deleting table: {}.{}", namespaceName, tableName);
        
        try {
            boolean deleted = metadataService.deleteTable(namespaceName, tableName);
            if (deleted) {
                return ResponseEntity.ok().build();
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            logger.error("Error deleting table: {}.{}", namespaceName, tableName, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Update table statistics
     */
    @PutMapping("/namespaces/{namespaceName}/tables/{tableName}/stats")
    public ResponseEntity<Void> updateTableStats(@PathVariable String namespaceName,
                                                @PathVariable String tableName,
                                                @RequestBody UpdateStatsRequest request) {
        logger.debug("Updating stats for table: {}.{}", namespaceName, tableName);
        
        try {
            metadataService.updateTableStatistics(namespaceName, tableName, 
                                                 request.getRowCount(), 
                                                 request.getDataSizeBytes());
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            logger.error("Error updating table stats: {}.{}", namespaceName, tableName, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Get registry statistics
     */
    @GetMapping("/stats")
    public ResponseEntity<MetadataService.RegistryStats> getRegistryStats() {
        logger.debug("Getting registry statistics");
        
        try {
            MetadataService.RegistryStats stats = metadataService.getRegistryStats();
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            logger.error("Error getting registry statistics", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Request DTO for table registration
     */
    public static class RegisterTableRequest {
        private String tableLocation;
        private String schemaDefinition;
        
        public String getTableLocation() { return tableLocation; }
        public void setTableLocation(String tableLocation) { this.tableLocation = tableLocation; }
        
        public String getSchemaDefinition() { return schemaDefinition; }
        public void setSchemaDefinition(String schemaDefinition) { this.schemaDefinition = schemaDefinition; }
    }
    
    /**
     * Request DTO for updating table statistics
     */
    public static class UpdateStatsRequest {
        private Long rowCount;
        private Long dataSizeBytes;
        
        public Long getRowCount() { return rowCount; }
        public void setRowCount(Long rowCount) { this.rowCount = rowCount; }
        
        public Long getDataSizeBytes() { return dataSizeBytes; }
        public void setDataSizeBytes(Long dataSizeBytes) { this.dataSizeBytes = dataSizeBytes; }
    }
}