package com.minicloud.controlplane.service;

import com.minicloud.controlplane.dto.TableInfo;
import com.minicloud.controlplane.model.TableMetadata;
import com.minicloud.controlplane.repository.TableMetadataRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service for managing table metadata and registry operations
 */
@Service
@Transactional
public class MetadataService {
    
    private static final Logger logger = LoggerFactory.getLogger(MetadataService.class);
    
    @Autowired
    private TableMetadataRepository tableMetadataRepository;
    
    /**
     * Register a new table in the metadata registry
     */
    public TableInfo registerTable(String namespaceName, String tableName, String tableLocation, String schemaDefinition) {
        logger.info("Registering table: {}.{} at location: {}", namespaceName, tableName, tableLocation);
        
        // Check if table already exists
        if (tableMetadataRepository.existsByNamespaceNameAndTableName(namespaceName, tableName)) {
            throw new IllegalArgumentException("Table " + namespaceName + "." + tableName + " already exists");
        }
        
        TableMetadata metadata = new TableMetadata(namespaceName, tableName, tableLocation, schemaDefinition);
        metadata = tableMetadataRepository.save(metadata);
        
        logger.info("Successfully registered table: {}.{} with ID: {}", namespaceName, tableName, metadata.getId());
        return convertToTableInfo(metadata);
    }
    
    /**
     * Get table information by namespace and table name
     */
    @Transactional(readOnly = true)
    public Optional<TableInfo> getTable(String namespaceName, String tableName) {
        logger.debug("Looking up table: {}.{}", namespaceName, tableName);
        
        return tableMetadataRepository.findByNamespaceNameAndTableName(namespaceName, tableName)
                .map(this::convertToTableInfo);
    }
    
    /**
     * List all tables in a namespace
     */
    @Transactional(readOnly = true)
    public List<TableInfo> listTables(String namespaceName) {
        logger.debug("Listing tables in namespace: {}", namespaceName);
        
        return tableMetadataRepository.findByNamespaceName(namespaceName)
                .stream()
                .map(this::convertToTableInfo)
                .collect(Collectors.toList());
    }
    
    /**
     * List all tables in the registry
     */
    @Transactional(readOnly = true)
    public List<TableInfo> listAllTables() {
        logger.debug("Listing all tables");
        
        return tableMetadataRepository.findAll()
                .stream()
                .map(this::convertToTableInfo)
                .collect(Collectors.toList());
    }
    
    /**
     * Update table statistics (row count, data size)
     */
    public void updateTableStatistics(String namespaceName, String tableName, Long rowCount, Long dataSizeBytes) {
        logger.debug("Updating statistics for table: {}.{} - rows: {}, size: {} bytes", 
                    namespaceName, tableName, rowCount, dataSizeBytes);
        
        Optional<TableMetadata> optionalMetadata = tableMetadataRepository.findByNamespaceNameAndTableName(namespaceName, tableName);
        if (optionalMetadata.isPresent()) {
            TableMetadata metadata = optionalMetadata.get();
            metadata.setRowCount(rowCount);
            metadata.setDataSizeBytes(dataSizeBytes);
            tableMetadataRepository.save(metadata);
            
            logger.info("Updated statistics for table: {}.{}", namespaceName, tableName);
        } else {
            logger.warn("Table not found for statistics update: {}.{}", namespaceName, tableName);
        }
    }
    
    /**
     * Check if a table exists
     */
    @Transactional(readOnly = true)
    public boolean tableExists(String namespaceName, String tableName) {
        return tableMetadataRepository.existsByNamespaceNameAndTableName(namespaceName, tableName);
    }
    
    /**
     * Delete a table from the registry
     */
    public boolean deleteTable(String namespaceName, String tableName) {
        logger.info("Deleting table: {}.{}", namespaceName, tableName);
        
        Optional<TableMetadata> optionalMetadata = tableMetadataRepository.findByNamespaceNameAndTableName(namespaceName, tableName);
        if (optionalMetadata.isPresent()) {
            tableMetadataRepository.delete(optionalMetadata.get());
            logger.info("Successfully deleted table: {}.{}", namespaceName, tableName);
            return true;
        } else {
            logger.warn("Table not found for deletion: {}.{}", namespaceName, tableName);
            return false;
        }
    }
    
    /**
     * Get registry statistics
     */
    @Transactional(readOnly = true)
    public RegistryStats getRegistryStats() {
        long totalTables = tableMetadataRepository.count();
        Long totalRows = tableMetadataRepository.getTotalRowCount();
        Long totalDataSize = tableMetadataRepository.getTotalDataSize();
        
        return new RegistryStats(totalTables, totalRows != null ? totalRows : 0L, totalDataSize != null ? totalDataSize : 0L);
    }
    
    /**
     * Convert TableMetadata entity to TableInfo DTO
     */
    private TableInfo convertToTableInfo(TableMetadata metadata) {
        TableInfo info = new TableInfo(metadata.getNamespaceName(), metadata.getTableName(), metadata.getTableLocation());
        info.setTableFormat(metadata.getTableFormat());
        info.setRowCount(metadata.getRowCount());
        info.setDataSizeBytes(metadata.getDataSizeBytes());
        info.setCreatedAt(metadata.getCreatedAt());
        info.setUpdatedAt(metadata.getUpdatedAt());
        return info;
    }
    
    /**
     * Inner class for registry statistics
     */
    public static class RegistryStats {
        private final long totalTables;
        private final long totalRows;
        private final long totalDataSizeBytes;
        
        public RegistryStats(long totalTables, long totalRows, long totalDataSizeBytes) {
            this.totalTables = totalTables;
            this.totalRows = totalRows;
            this.totalDataSizeBytes = totalDataSizeBytes;
        }
        
        public long getTotalTables() { return totalTables; }
        public long getTotalRows() { return totalRows; }
        public long getTotalDataSizeBytes() { return totalDataSizeBytes; }
        
        @Override
        public String toString() {
            return "RegistryStats{" +
                    "totalTables=" + totalTables +
                    ", totalRows=" + totalRows +
                    ", totalDataSizeBytes=" + totalDataSizeBytes +
                    '}';
        }
    }
}