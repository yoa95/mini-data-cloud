package com.minicloud.controlplane.service;

import com.minicloud.controlplane.dto.QueryRequest;
import com.minicloud.controlplane.dto.QueryResponse;
import com.minicloud.controlplane.planner.DistributedQueryPlanner;
import com.minicloud.controlplane.planner.ExecutionPlan;
import com.minicloud.controlplane.planner.QueryScheduler;
import com.minicloud.controlplane.sql.ParsedQuery;
import com.minicloud.controlplane.sql.SqlParsingService;
import com.minicloud.controlplane.sql.SqlParsingException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.List;

/**
 * Service for distributed query execution across multiple workers.
 * Integrates query planning, scheduling, and result aggregation.
 */
@Service
public class DistributedQueryService {
    
    private static final Logger logger = LoggerFactory.getLogger(DistributedQueryService.class);
    
    @Autowired
    private SqlParsingService sqlParsingService;
    
    @Autowired
    private DistributedQueryPlanner queryPlanner;
    
    @Autowired
    private QueryScheduler queryScheduler;
    
    @Autowired
    private WorkerRegistryService workerRegistryService;
    
    // Track active distributed queries
    private final Map<String, CompletableFuture<QueryScheduler.QueryExecutionResult>> activeQueries = new ConcurrentHashMap<>();
    
    /**
     * Execute a query using distributed execution
     */
    public CompletableFuture<QueryResponse> executeDistributedQuery(QueryRequest request) {
        String queryId = generateQueryId();
        logger.info("Starting distributed query execution: {}", queryId);
        
        return CompletableFuture.supplyAsync(() -> {
            try {
                // Check if we have healthy workers
                if (workerRegistryService.getHealthyWorkers().isEmpty()) {
                    logger.warn("No healthy workers available, falling back to local execution");
                    return createErrorResponse(queryId, "No healthy workers available for distributed execution");
                }
                
                // Parse and validate the SQL query
                ParsedQuery parsedQuery;
                try {
                    parsedQuery = sqlParsingService.parseAndValidateQuery(request.getSql());
                } catch (SqlParsingException e) {
                    logger.error("SQL parsing failed for distributed query {}: {}", queryId, e.getMessage());
                    return createErrorResponse(queryId, "SQL parsing failed: " + e.getMessage());
                }
                
                // Create distributed execution plan
                ExecutionPlan executionPlan = queryPlanner.createExecutionPlan(queryId, parsedQuery);
                logger.info("Created execution plan with {} stages for query {}", 
                           executionPlan.getStageCount(), queryId);
                
                // Execute the plan
                CompletableFuture<QueryScheduler.QueryExecutionResult> executionFuture = 
                        queryScheduler.executeQuery(executionPlan);
                
                activeQueries.put(queryId, executionFuture);
                
                // Wait for execution to complete
                QueryScheduler.QueryExecutionResult result = executionFuture.get();
                activeQueries.remove(queryId);
                
                if (result.isSuccess()) {
                    return createSuccessResponse(queryId, result);
                } else {
                    return createErrorResponse(queryId, result.getErrorMessage());
                }
                
            } catch (Exception e) {
                logger.error("Distributed query execution failed for {}", queryId, e);
                activeQueries.remove(queryId);
                return createErrorResponse(queryId, "Execution failed: " + e.getMessage());
            }
        });
    }
    
    private String generateQueryId() {
        return "dist_query_" + UUID.randomUUID().toString().replace("-", "");
    }
    
    private QueryResponse createSuccessResponse(String queryId, QueryScheduler.QueryExecutionResult result) {
        QueryResponse response = new QueryResponse(queryId, 
                com.minicloud.controlplane.model.QueryStatus.COMPLETED);
        
        if (result.getResult() != null) {
            response.setColumns(result.getResult().getColumns());
            // Convert List<List<Object>> to List<List<String>> for compatibility
            List<List<String>> stringRows = result.getResult().getRows().stream()
                    .map(row -> row.stream()
                            .map(obj -> obj != null ? obj.toString() : "")
                            .collect(java.util.stream.Collectors.toList()))
                    .collect(java.util.stream.Collectors.toList());
            response.setRows(stringRows);
            response.setRowsReturned(result.getTotalRows());
        }
        
        return response;
    }
    
    private QueryResponse createErrorResponse(String queryId, String errorMessage) {
        QueryResponse response = new QueryResponse(queryId, 
                com.minicloud.controlplane.model.QueryStatus.FAILED);
        response.setErrorMessage(errorMessage);
        return response;
    }
}