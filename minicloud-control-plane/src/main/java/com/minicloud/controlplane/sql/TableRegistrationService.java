package com.minicloud.controlplane.sql;

import com.minicloud.controlplane.dto.TableInfo;
import org.apache.calcite.rel.type.RelDataType;
import org.apache.calcite.rel.type.RelDataTypeFactory;
import org.apache.calcite.schema.impl.AbstractTable;
import org.apache.calcite.sql.type.SqlTypeName;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service for registering tables with the Calcite schema
 */
@Service
public class TableRegistrationService {
    
    private static final Logger logger = LoggerFactory.getLogger(TableRegistrationService.class);
    
    // Static registry to avoid Spring dependency issues
    private static final Map<String, org.apache.calcite.schema.Table> REGISTERED_TABLES = new ConcurrentHashMap<>();
    
    /**
     * Register a table with the Calcite schema
     */
    public void registerTable(String tableName, TableInfo tableInfo) {
        try {
            // Create a simple table for now
            SimpleTable table = new SimpleTable(tableName);
            REGISTERED_TABLES.put(tableName, table);
            logger.info("Registered table '{}' with static registry", tableName);
        } catch (Exception e) {
            logger.error("Failed to register table '{}' with static registry: {}", tableName, e.getMessage(), e);
        }
    }
    
    /**
     * Get all registered tables
     */
    public static Map<String, org.apache.calcite.schema.Table> getRegisteredTables() {
        return REGISTERED_TABLES;
    }
    
    /**
     * Simple table implementation for Calcite
     */
    private static class SimpleTable extends AbstractTable {
        
        private final String tableName;
        
        public SimpleTable(String tableName) {
            this.tableName = tableName;
        }
        
        @Override
        public RelDataType getRowType(RelDataTypeFactory typeFactory) {
            // Create a simple schema for bank_transactions
            return typeFactory.builder()
                    .add("id", SqlTypeName.VARCHAR)
                    .add("date", SqlTypeName.VARCHAR)
                    .add("description", SqlTypeName.VARCHAR)
                    .add("category", SqlTypeName.VARCHAR)
                    .add("amount", SqlTypeName.VARCHAR)
                    .add("balance", SqlTypeName.VARCHAR)
                    .build();
        }
    }
}