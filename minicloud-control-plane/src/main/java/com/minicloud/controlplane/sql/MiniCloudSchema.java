package com.minicloud.controlplane.sql;

import org.apache.calcite.schema.Table;
import org.apache.calcite.schema.impl.AbstractSchema;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Custom Calcite schema for MiniCloud that supports dynamic table registration
 */
public class MiniCloudSchema extends AbstractSchema {
    
    private static final Logger logger = LoggerFactory.getLogger(MiniCloudSchema.class);
    
    private final Map<String, Table> tables = new ConcurrentHashMap<>();
    
    @Override
    protected Map<String, Table> getTableMap() {
        logger.debug("Getting table map with {} tables", tables.size());
        return tables;
    }
    
    /**
     * Register a table with this schema
     */
    public void addTable(String tableName, Table table) {
        tables.put(tableName, table);
        logger.info("Added table to schema: {}", tableName);
    }
    
    /**
     * Remove a table from this schema
     */
    public void removeTable(String tableName) {
        tables.remove(tableName);
        logger.info("Removed table from schema: {}", tableName);
    }
    
    /**
     * Check if a table exists
     */
    public boolean hasTable(String tableName) {
        return tables.containsKey(tableName);
    }
    
    /**
     * Get the number of registered tables
     */
    public int getTableCount() {
        return tables.size();
    }
    
    @Override
    public boolean isMutable() {
        return true;  // Allow table creation and modification
    }
}