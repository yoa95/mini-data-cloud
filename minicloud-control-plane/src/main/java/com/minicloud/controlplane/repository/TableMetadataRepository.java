package com.minicloud.controlplane.repository;

import com.minicloud.controlplane.model.TableMetadata;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository interface for TableMetadata entities
 */
@Repository
public interface TableMetadataRepository extends JpaRepository<TableMetadata, Long> {
    
    /**
     * Find table by namespace and table name
     */
    Optional<TableMetadata> findByNamespaceNameAndTableName(String namespaceName, String tableName);
    
    /**
     * Find all tables in a namespace
     */
    List<TableMetadata> findByNamespaceName(String namespaceName);
    
    /**
     * Check if table exists
     */
    boolean existsByNamespaceNameAndTableName(String namespaceName, String tableName);
    
    /**
     * Find tables by format
     */
    List<TableMetadata> findByTableFormat(String tableFormat);
    
    /**
     * Get total row count across all tables
     */
    @Query("SELECT COALESCE(SUM(t.rowCount), 0) FROM TableMetadata t")
    Long getTotalRowCount();
    
    /**
     * Get total data size across all tables
     */
    @Query("SELECT COALESCE(SUM(t.dataSizeBytes), 0) FROM TableMetadata t")
    Long getTotalDataSize();
    
    /**
     * Find tables with row count greater than threshold
     */
    @Query("SELECT t FROM TableMetadata t WHERE t.rowCount > :threshold ORDER BY t.rowCount DESC")
    List<TableMetadata> findTablesWithRowCountGreaterThan(@Param("threshold") Long threshold);
}