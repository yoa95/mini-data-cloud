package com.minicloud.common.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Represents a SQL query request from clients
 */
public class QueryRequest {
    private final String queryId;
    private final String sql;
    private final Map<String, Object> parameters;
    private final Map<String, String> sessionProperties;
    private final Instant submittedAt;
    private final String traceId;

    @JsonCreator
    public QueryRequest(
            @JsonProperty("queryId") String queryId,
            @JsonProperty("sql") String sql,
            @JsonProperty("parameters") Map<String, Object> parameters,
            @JsonProperty("sessionProperties") Map<String, String> sessionProperties,
            @JsonProperty("submittedAt") Instant submittedAt,
            @JsonProperty("traceId") String traceId) {
        this.queryId = queryId != null ? queryId : UUID.randomUUID().toString();
        this.sql = Objects.requireNonNull(sql, "SQL cannot be null");
        this.parameters = parameters != null ? parameters : Map.of();
        this.sessionProperties = sessionProperties != null ? sessionProperties : Map.of();
        this.submittedAt = submittedAt != null ? submittedAt : Instant.now();
        this.traceId = traceId != null ? traceId : UUID.randomUUID().toString();
    }

    public static QueryRequest of(String sql) {
        return new QueryRequest(null, sql, null, null, null, null);
    }

    public static QueryRequest of(String sql, Map<String, Object> parameters) {
        return new QueryRequest(null, sql, parameters, null, null, null);
    }

    public String getQueryId() {
        return queryId;
    }

    public String getSql() {
        return sql;
    }

    public Map<String, Object> getParameters() {
        return parameters;
    }

    public Map<String, String> getSessionProperties() {
        return sessionProperties;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public String getTraceId() {
        return traceId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        QueryRequest that = (QueryRequest) o;
        return Objects.equals(queryId, that.queryId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(queryId);
    }

    @Override
    public String toString() {
        return "QueryRequest{" +
                "queryId='" + queryId + '\'' +
                ", sql='" + sql + '\'' +
                ", traceId='" + traceId + '\'' +
                '}';
    }
}