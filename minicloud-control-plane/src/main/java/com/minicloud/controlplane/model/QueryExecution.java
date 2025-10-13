package com.minicloud.controlplane.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.Objects;

/**
 * Entity representing a query execution in the control plane
 */
@Entity
@Table(name = "query_execution")
public class QueryExecution {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "query_id", nullable = false, unique = true)
    private String queryId;
    
    @Column(name = "sql_query", columnDefinition = "TEXT", nullable = false)
    private String sqlQuery;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private QueryStatus status;
    
    @Column(name = "submitted_at", nullable = false)
    private LocalDateTime submittedAt;
    
    @Column(name = "started_at")
    private LocalDateTime startedAt;
    
    @Column(name = "completed_at")
    private LocalDateTime completedAt;
    
    @Column(name = "execution_time_ms")
    private Long executionTimeMs;
    
    @Column(name = "rows_returned")
    private Long rowsReturned;
    
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;
    
    @Column(name = "result_location")
    private String resultLocation;
    
    // Constructors
    public QueryExecution() {
        this.submittedAt = LocalDateTime.now();
        this.status = QueryStatus.SUBMITTED;
    }
    
    public QueryExecution(String queryId, String sqlQuery) {
        this();
        this.queryId = queryId;
        this.sqlQuery = sqlQuery;
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public String getQueryId() {
        return queryId;
    }
    
    public void setQueryId(String queryId) {
        this.queryId = queryId;
    }
    
    public String getSqlQuery() {
        return sqlQuery;
    }
    
    public void setSqlQuery(String sqlQuery) {
        this.sqlQuery = sqlQuery;
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
    
    // Utility methods
    public void markAsStarted() {
        this.status = QueryStatus.RUNNING;
        this.startedAt = LocalDateTime.now();
    }
    
    public void markAsCompleted(Long rowsReturned, String resultLocation) {
        this.status = QueryStatus.COMPLETED;
        this.completedAt = LocalDateTime.now();
        this.rowsReturned = rowsReturned;
        this.resultLocation = resultLocation;
        if (this.startedAt != null) {
            this.executionTimeMs = java.time.Duration.between(this.startedAt, this.completedAt).toMillis();
        }
    }
    
    public void markAsFailed(String errorMessage) {
        this.status = QueryStatus.FAILED;
        this.completedAt = LocalDateTime.now();
        this.errorMessage = errorMessage;
        if (this.startedAt != null) {
            this.executionTimeMs = java.time.Duration.between(this.startedAt, this.completedAt).toMillis();
        }
    }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        QueryExecution that = (QueryExecution) o;
        return Objects.equals(queryId, that.queryId);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(queryId);
    }
    
    @Override
    public String toString() {
        return "QueryExecution{" +
                "id=" + id +
                ", queryId='" + queryId + '\'' +
                ", status=" + status +
                ", submittedAt=" + submittedAt +
                ", executionTimeMs=" + executionTimeMs +
                ", rowsReturned=" + rowsReturned +
                '}';
    }
}