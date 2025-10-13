package com.minicloud.controlplane.dto;

import com.minicloud.controlplane.model.QueryStatus;
import java.time.LocalDateTime;

/**
 * DTO for query execution responses
 */
public class QueryResponse {
    
    private String queryId;
    private QueryStatus status;
    private LocalDateTime submittedAt;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private Long executionTimeMs;
    private Long rowsReturned;
    private String errorMessage;
    private String resultLocation;
    
    // Constructors
    public QueryResponse() {}
    
    public QueryResponse(String queryId, QueryStatus status) {
        this.queryId = queryId;
        this.status = status;
    }
    
    // Getters and Setters
    public String getQueryId() {
        return queryId;
    }
    
    public void setQueryId(String queryId) {
        this.queryId = queryId;
    }
    
    public QueryStatus getStatus() {
        return status;
    }
    
    public void setStatus(QueryStatus status) {
        this.status = status;
    }
    
    public LocalDateTime getSubmittedAt() {
        return submittedAt;
    }
    
    public void setSubmittedAt(LocalDateTime submittedAt) {
        this.submittedAt = submittedAt;
    }
    
    public LocalDateTime getStartedAt() {
        return startedAt;
    }
    
    public void setStartedAt(LocalDateTime startedAt) {
        this.startedAt = startedAt;
    }
    
    public LocalDateTime getCompletedAt() {
        return completedAt;
    }
    
    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }
    
    public Long getExecutionTimeMs() {
        return executionTimeMs;
    }
    
    public void setExecutionTimeMs(Long executionTimeMs) {
        this.executionTimeMs = executionTimeMs;
    }
    
    public Long getRowsReturned() {
        return rowsReturned;
    }
    
    public void setRowsReturned(Long rowsReturned) {
        this.rowsReturned = rowsReturned;
    }
    
    public String getErrorMessage() {
        return errorMessage;
    }
    
    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }
    
    public String getResultLocation() {
        return resultLocation;
    }
    
    public void setResultLocation(String resultLocation) {
        this.resultLocation = resultLocation;
    }
    
    @Override
    public String toString() {
        return "QueryResponse{" +
                "queryId='" + queryId + '\'' +
                ", status=" + status +
                ", submittedAt=" + submittedAt +
                ", executionTimeMs=" + executionTimeMs +
                ", rowsReturned=" + rowsReturned +
                '}';
    }
}