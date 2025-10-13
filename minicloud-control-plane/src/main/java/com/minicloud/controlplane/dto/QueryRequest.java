package com.minicloud.controlplane.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * DTO for query submission requests
 */
public class QueryRequest {
    
    @NotBlank(message = "SQL query cannot be blank")
    @Size(max = 10000, message = "SQL query cannot exceed 10000 characters")
    private String sql;
    
    private String sessionId;
    
    // Constructors
    public QueryRequest() {}
    
    public QueryRequest(String sql) {
        this.sql = sql;
    }
    
    public QueryRequest(String sql, String sessionId) {
        this.sql = sql;
        this.sessionId = sessionId;
    }
    
    // Getters and Setters
    public String getSql() {
        return sql;
    }
    
    public void setSql(String sql) {
        this.sql = sql;
    }
    
    public String getSessionId() {
        return sessionId;
    }
    
    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }
    
    @Override
    public String toString() {
        return "QueryRequest{" +
                "sql='" + (sql != null ? sql.substring(0, Math.min(sql.length(), 100)) + "..." : null) + '\'' +
                ", sessionId='" + sessionId + '\'' +
                '}';
    }
}