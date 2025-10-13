package com.minicloud.controlplane.service;

import com.minicloud.controlplane.dto.QueryRequest;
import com.minicloud.controlplane.dto.QueryResponse;
import com.minicloud.controlplane.model.QueryExecution;
import com.minicloud.controlplane.model.QueryStatus;
import com.minicloud.controlplane.repository.QueryExecutionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for managing query execution and lifecycle
 */
@Service
@Transactional
public class QueryService {
    
    private static final Logger logger = LoggerFactory.getLogger(QueryService.class);
    
    @Autowired
    private QueryExecutionRepository queryExecutionRepository;
    
    /**
     * Submit a new query for execution
     */
    public QueryResponse submitQuery(QueryRequest request) {
        String queryId = generateQueryId();
        logger.info("Submitting query with ID: {} - SQL: {}", queryId, 
                   request.getSql().substring(0, Math.min(request.getSql().length(), 100)) + "...");
        
        QueryExecution execution = new QueryExecution(queryId, request.getSql());
        execution = queryExecutionRepository.save(execution);
        
        // TODO: In Phase 2, this will trigger actual query planning and execution
        // For now, we just store the query and return a response
        
        logger.info("Query submitted successfully with ID: {}", queryId);
        return convertToQueryResponse(execution);
    }
    
    /**
     * Get query status and details
     */
    @Transactional(readOnly = true)
    public Optional<QueryResponse> getQueryStatus(String queryId) {
        logger.debug("Getting status for query: {}", queryId);
        
        return queryExecutionRepository.findByQueryId(queryId)
                .map(this::convertToQueryResponse);
    }
    
    /**
     * List recent queries
     */
    @Transactional(readOnly = true)
    public List<QueryResponse> getRecentQueries(int limit) {
        logger.debug("Getting {} recent queries", limit);
        
        return queryExecutionRepository.findRecentQueries()
                .stream()
                .limit(limit)
                .map(this::convertToQueryResponse)
                .collect(Collectors.toList());
    }
    
    /**
     * List running queries
     */
    @Transactional(readOnly = true)
    public List<QueryResponse> getRunningQueries() {
        logger.debug("Getting running queries");
        
        return queryExecutionRepository.findRunningQueries()
                .stream()
                .map(this::convertToQueryResponse)
                .collect(Collectors.toList());
    }
    
    /**
     * Cancel a query
     */
    public boolean cancelQuery(String queryId) {
        logger.info("Cancelling query: {}", queryId);
        
        Optional<QueryExecution> optionalExecution = queryExecutionRepository.findByQueryId(queryId);
        if (optionalExecution.isPresent()) {
            QueryExecution execution = optionalExecution.get();
            if (execution.getStatus() == QueryStatus.SUBMITTED || execution.getStatus() == QueryStatus.RUNNING) {
                execution.setStatus(QueryStatus.CANCELLED);
                queryExecutionRepository.save(execution);
                
                logger.info("Query cancelled successfully: {}", queryId);
                return true;
            } else {
                logger.warn("Cannot cancel query {} - current status: {}", queryId, execution.getStatus());
                return false;
            }
        } else {
            logger.warn("Query not found for cancellation: {}", queryId);
            return false;
        }
    }
    
    /**
     * Mark query as started (called by execution engine)
     */
    public void markQueryAsStarted(String queryId) {
        logger.debug("Marking query as started: {}", queryId);
        
        Optional<QueryExecution> optionalExecution = queryExecutionRepository.findByQueryId(queryId);
        if (optionalExecution.isPresent()) {
            QueryExecution execution = optionalExecution.get();
            execution.markAsStarted();
            queryExecutionRepository.save(execution);
        }
    }
    
    /**
     * Mark query as completed (called by execution engine)
     */
    public void markQueryAsCompleted(String queryId, Long rowsReturned, String resultLocation) {
        logger.info("Marking query as completed: {} - rows: {}", queryId, rowsReturned);
        
        Optional<QueryExecution> optionalExecution = queryExecutionRepository.findByQueryId(queryId);
        if (optionalExecution.isPresent()) {
            QueryExecution execution = optionalExecution.get();
            execution.markAsCompleted(rowsReturned, resultLocation);
            queryExecutionRepository.save(execution);
        }
    }
    
    /**
     * Mark query as failed (called by execution engine)
     */
    public void markQueryAsFailed(String queryId, String errorMessage) {
        logger.error("Marking query as failed: {} - error: {}", queryId, errorMessage);
        
        Optional<QueryExecution> optionalExecution = queryExecutionRepository.findByQueryId(queryId);
        if (optionalExecution.isPresent()) {
            QueryExecution execution = optionalExecution.get();
            execution.markAsFailed(errorMessage);
            queryExecutionRepository.save(execution);
        }
    }
    
    /**
     * Get query execution statistics
     */
    @Transactional(readOnly = true)
    public QueryStats getQueryStats() {
        long totalQueries = queryExecutionRepository.count();
        long completedQueries = queryExecutionRepository.countByStatus(QueryStatus.COMPLETED);
        long failedQueries = queryExecutionRepository.countByStatus(QueryStatus.FAILED);
        long runningQueries = queryExecutionRepository.countByStatus(QueryStatus.RUNNING);
        Double avgExecutionTime = queryExecutionRepository.getAverageExecutionTime();
        
        return new QueryStats(totalQueries, completedQueries, failedQueries, runningQueries, 
                             avgExecutionTime != null ? avgExecutionTime : 0.0);
    }
    
    /**
     * Generate a unique query ID
     */
    private String generateQueryId() {
        return "query_" + UUID.randomUUID().toString().replace("-", "");
    }
    
    /**
     * Convert QueryExecution entity to QueryResponse DTO
     */
    private QueryResponse convertToQueryResponse(QueryExecution execution) {
        QueryResponse response = new QueryResponse(execution.getQueryId(), execution.getStatus());
        response.setSubmittedAt(execution.getSubmittedAt());
        response.setStartedAt(execution.getStartedAt());
        response.setCompletedAt(execution.getCompletedAt());
        response.setExecutionTimeMs(execution.getExecutionTimeMs());
        response.setRowsReturned(execution.getRowsReturned());
        response.setErrorMessage(execution.getErrorMessage());
        response.setResultLocation(execution.getResultLocation());
        return response;
    }
    
    /**
     * Inner class for query statistics
     */
    public static class QueryStats {
        private final long totalQueries;
        private final long completedQueries;
        private final long failedQueries;
        private final long runningQueries;
        private final double averageExecutionTimeMs;
        
        public QueryStats(long totalQueries, long completedQueries, long failedQueries, 
                         long runningQueries, double averageExecutionTimeMs) {
            this.totalQueries = totalQueries;
            this.completedQueries = completedQueries;
            this.failedQueries = failedQueries;
            this.runningQueries = runningQueries;
            this.averageExecutionTimeMs = averageExecutionTimeMs;
        }
        
        public long getTotalQueries() { return totalQueries; }
        public long getCompletedQueries() { return completedQueries; }
        public long getFailedQueries() { return failedQueries; }
        public long getRunningQueries() { return runningQueries; }
        public double getAverageExecutionTimeMs() { return averageExecutionTimeMs; }
        
        @Override
        public String toString() {
            return "QueryStats{" +
                    "totalQueries=" + totalQueries +
                    ", completedQueries=" + completedQueries +
                    ", failedQueries=" + failedQueries +
                    ", runningQueries=" + runningQueries +
                    ", averageExecutionTimeMs=" + averageExecutionTimeMs +
                    '}';
        }
    }
}