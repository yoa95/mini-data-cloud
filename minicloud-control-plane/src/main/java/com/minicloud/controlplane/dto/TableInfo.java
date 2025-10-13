package com.minicloud.controlplane.dto;

import java.time.LocalDateTime;

/**
 * DTO for table information responses
 */
public class TableInfo {
    
    private String namespaceName;
    private String tableName;
    private String tableLocation;
    private String tableFormat;
    private Long rowCount;
    private Long dataSizeBytes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Constructors
    public TableInfo() {}
    
    public TableInfo(String namespaceName, String tableName, String tableLocation) {
        this.namespaceName = namespaceName;
        this.tableName = tableName;
        this.tableLocation = tableLocation;
    }
    
    // Getters and Setters
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
    
    public String getFullTableName() {
        return namespaceName + "." + tableName;
    }
    
    @Override
    public String toString() {
        return "TableInfo{" +
                "namespaceName='" + namespaceName + '\'' +
                ", tableName='" + tableName + '\'' +
                ", tableFormat='" + tableFormat + '\'' +
                ", rowCount=" + rowCount +
                ", dataSizeBytes=" + dataSizeBytes +
                '}';
    }
}