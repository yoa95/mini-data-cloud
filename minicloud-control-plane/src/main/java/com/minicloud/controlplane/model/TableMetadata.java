package com.minicloud.controlplane.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.Objects;

/**
 * Entity representing table metadata in the control plane registry
 */
@Entity
@Table(name = "table_metadata")
public class TableMetadata {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "namespace_name", nullable = false)
    private String namespaceName;
    
    @Column(name = "table_name", nullable = false)
    private String tableName;
    
    @Column(name = "table_location", nullable = false)
    private String tableLocation;
    
    @Column(name = "schema_definition", columnDefinition = "TEXT")
    private String schemaDefinition;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
    
    @Column(name = "table_format")
    private String tableFormat = "PARQUET";
    
    @Column(name = "row_count")
    private Long rowCount = 0L;
    
    @Column(name = "data_size_bytes")
    private Long dataSizeBytes = 0L;
    
    // Constructors
    public TableMetadata() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }
    
    public TableMetadata(String namespaceName, String tableName, String tableLocation, String schemaDefinition) {
        this();
        this.namespaceName = namespaceName;
        this.tableName = tableName;
        this.tableLocation = tableLocation;
        this.schemaDefinition = schemaDefinition;
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public String getNamespaceName() {
        return namespaceName;
    }
    
    public void setNamespaceName(String namespaceName) {
        this.namespaceName = namespaceName;
    }
    
    public String getTableName() {
        return tableName;
    }
    
    public void setTableName(String tableName) {
        this.tableName = tableName;
    }
    
    public String getTableLocation() {
        return tableLocation;
    }
    
    public void setTableLocation(String tableLocation) {
        this.tableLocation = tableLocation;
    }
    
    public String getSchemaDefinition() {
        return schemaDefinition;
    }
    
    public void setSchemaDefinition(String schemaDefinition) {
        this.schemaDefinition = schemaDefinition;
    }
    
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
    
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
    
    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
    
    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
    
    public String getTableFormat() {
        return tableFormat;
    }
    
    public void setTableFormat(String tableFormat) {
        this.tableFormat = tableFormat;
    }
    
    public Long getRowCount() {
        return rowCount;
    }
    
    public void setRowCount(Long rowCount) {
        this.rowCount = rowCount;
    }
    
    public Long getDataSizeBytes() {
        return dataSizeBytes;
    }
    
    public void setDataSizeBytes(Long dataSizeBytes) {
        this.dataSizeBytes = dataSizeBytes;
    }
    
    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
    
    // Utility methods
    public String getFullTableName() {
        return namespaceName + "." + tableName;
    }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        TableMetadata that = (TableMetadata) o;
        return Objects.equals(namespaceName, that.namespaceName) &&
               Objects.equals(tableName, that.tableName);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(namespaceName, tableName);
    }
    
    @Override
    public String toString() {
        return "TableMetadata{" +
                "id=" + id +
                ", namespaceName='" + namespaceName + '\'' +
                ", tableName='" + tableName + '\'' +
                ", tableLocation='" + tableLocation + '\'' +
                ", tableFormat='" + tableFormat + '\'' +
                ", rowCount=" + rowCount +
                ", dataSizeBytes=" + dataSizeBytes +
                ", createdAt=" + createdAt +
                ", updatedAt=" + updatedAt +
                '}';
    }
}