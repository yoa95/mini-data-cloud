package com.minicloud.controlplane.sql;

import com.minicloud.controlplane.dto.TableInfo;
import org.apache.calcite.rel.type.RelDataType;
import org.apache.calcite.rel.type.RelDataTypeFactory;
import org.apache.calcite.schema.impl.AbstractTable;
import org.apache.calcite.sql.type.SqlTypeName;
import org.apache.calcite.sql.type.SqlTypeFactoryImpl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Service for registering tables with the Calcite schema
 */
@Service
public class TableRegistrationService {
    
    private static final Logger logger = LoggerFactory.getLogger(TableRegistrationService.class);
    
    @Autowired
    private MiniCloudSchema miniCloudSchema;
    
    /**
     * Register a table with the Calcite schema
     */
    public void registerTable(String tableName, TableInfo tableInfo) {
        try {
            // Create a simple table for now
            SimpleTable table = new SimpleTable(tableName);
            miniCloudSchema.addTable(tableName, table);
            logger.info("Registered table '{}' with Calcite schema", tableName);
        } catch (Exception e) {
            logger.error("Failed to register table '{}' with Calcite schema: {}", tableName, e.getMessage(), e);
        }
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