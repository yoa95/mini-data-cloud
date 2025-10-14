package com.minicloud.controlplane.sql;

import com.minicloud.controlplane.dto.TableInfo;
import com.minicloud.controlplane.service.MetadataService;
import org.apache.calcite.schema.Table;
import org.apache.calcite.schema.impl.AbstractSchema;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service for managing dynamic table registration with Calcite
 */
@Component
public class DynamicTableSchema {
    
    private static final Logger logger = LoggerFactory.getLogger(DynamicTableSchema.class);
    
    @Autowired
    private MetadataService metadataService;
    
    @Autowired
    private ParquetTableFactory parquetTableFactory;
    
    // Cache of registered tables
    private final Map<String, Table> tableCache = new ConcurrentHashMap<>();
    
    /**
     * Get all currently registered tables
     */
    public Map<String, Table> getAllTables() {
        logger.debug("Getting all registered tables");
        
        Map<String, Table> tableMap = new HashMap<>();
        
        try {
            // Get all registered tables from metadata service
            List<TableInfo> tables = metadataService.listAllTables();
            
            for (TableInfo tableInfo : tables) {
                String tableName = tableInfo.getTableName();
                
                // Check cache first
                Table calciteTable = tableCache.get(tableName);
                if (calciteTable == null) {
                    // Create new table and cache it
                    calciteTable = parquetTableFactory.createTable(tableInfo);
                    tableCache.put(tableName, calciteTable);
                    logger.debug("Created and cached table: {}", tableName);
                }
                
                tableMap.put(tableName, calciteTable);
            }
            
            logger.info("Retrieved {} tables", tableMap.size());
            
        } catch (Exception e) {
            logger.error("Error getting tables", e);
        }
        
        return tableMap;
    }
    
    /**
     * Register a new table
     */
    public void registerTable(String tableName, TableInfo tableInfo) {
        logger.info("Registering table: {}", tableName);
        
        try {
            Table calciteTable = parquetTableFactory.createTable(tableInfo);
            tableCache.put(tableName, calciteTable);
            logger.info("Successfully registered table: {}", tableName);
        } catch (Exception e) {
            logger.error("Error registering table: {}", tableName, e);
        }
    }
    
    /**
     * Remove a table from the cache
     */
    public void unregisterTable(String tableName) {
        tableCache.remove(tableName);
        logger.info("Unregistered table: {}", tableName);
    }
    
    /**
     * Clear all cached tables
     */
    public void clearCache() {
        tableCache.clear();
        logger.info("Cleared table cache");
    }
}