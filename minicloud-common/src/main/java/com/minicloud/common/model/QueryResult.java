package com.minicloud.common.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Represents the result of a SQL query execution
 */
public class QueryResult {
    private final String queryId;
    private final QueryStatus status;
    private final List<Map<String, Object>> rows;
    private final List<ColumnMetadata> columns;
    private final long totalRows;
    private final Duration executionTime;
    private final Instant completedAt;
    private final String errorMessage;
    private final ExecutionStatistics statistics;

    @JsonCreator
    public QueryResult(
            @JsonProperty("queryId") String queryId,
            @JsonProperty("status") QueryStatus status,
            @JsonProperty("rows") List<Map<String, Object>> rows,
            @JsonProperty("columns") List<ColumnMetadata> columns,
            @JsonProperty("totalRows") long totalRows,
            @JsonProperty("executionTime") Duration executionTime,
            @JsonProperty("completedAt") Instant completedAt,
            @JsonProperty("errorMessage") String errorMessage,
            @JsonProperty("statistics") ExecutionStatistics statistics) {
        this.queryId = Objects.requireNonNull(queryId);
        this.status = Objects.requireNonNull(status);
        this.rows = rows != null ? rows : List.of();
        this.columns = columns != null ? columns : List.of();
        this.totalRows = totalRows;
        this.executionTime = executionTime;
        this.completedAt = completedAt;
        this.errorMessage = errorMessage;
        this.statistics = statistics;
    }

    public static QueryResult success(String queryId, List<Map<String, Object>> rows, 
                                    List<ColumnMetadata> columns, ExecutionStatistics stats) {
        return new QueryResult(queryId, QueryStatus.COMPLETED, rows, columns, 
                             rows.size(), stats.getExecutionTime(), Instant.now(), null, stats);
    }

    public static QueryResult failure(String queryId, String errorMessage) {
        return new QueryResult(queryId, QueryStatus.FAILED, null, null, 0, 
                             null, Instant.now(), errorMessage, null);
    }

    public String getQueryId() {
        return queryId;
    }

    public QueryStatus getStatus() {
        return status;
    }

    public List<Map<String, Object>> getRows() {
        return rows;
    }

    public List<ColumnMetadata> getColumns() {
        return columns;
    }

    public long getTotalRows() {
        return totalRows;
    }

    public Duration getExecutionTime() {
        return executionTime;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public ExecutionStatistics getStatistics() {
        return statistics;
    }

    public enum QueryStatus {
        SUBMITTED,
        PLANNING,
        RUNNING,
        COMPLETED,
        FAILED,
        CANCELLED
    }

    @Override
    public String toString() {
        return "QueryResult{" +
                "queryId='" + queryId + '\'' +
                ", status=" + status +
                ", totalRows=" + totalRows +
                ", executionTime=" + executionTime +
                '}';
    }
}