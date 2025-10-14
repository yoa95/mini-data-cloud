package com.minicloud.controlplane.controller;

import com.minicloud.controlplane.dto.QueryRequest;
import com.minicloud.controlplane.dto.QueryResponse;
import com.minicloud.controlplane.service.QueryService;
import com.minicloud.controlplane.service.QueryResultService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * REST controller for query submission and management
 */
@RestController
@RequestMapping("/api/v1/queries")
@CrossOrigin(origins = "*") // For development - should be restricted in production
public class QueryController {
    
    private static final Logger logger = LoggerFactory.getLogger(QueryController.class);
    
    @Autowired
    private QueryService queryService;
    
    @Autowired
    private QueryResultService queryResultService;
    
    /**
     * Submit a new SQL query for execution
     */
    @PostMapping
    public ResponseEntity<QueryResponse> submitQuery(@Valid @RequestBody QueryRequest request) {
        logger.info("Received query submission request");
        
        try {
            QueryResponse response = queryService.submitQuery(request);
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
        } catch (Exception e) {
            logger.error("Error submitting query", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Get query status and details
     */
    @GetMapping("/{queryId}")
    public ResponseEntity<QueryResponse> getQueryStatus(@PathVariable String queryId) {
        logger.debug("Getting status for query: {}", queryId);
        
        Optional<QueryResponse> response = queryService.getQueryStatus(queryId);
        if (response.isPresent()) {
            return ResponseEntity.ok(response.get());
        } else {
            return ResponseEntity.notFound().build();
        }
    }
    
    /**
     * List recent queries
     */
    @GetMapping
    public ResponseEntity<List<QueryResponse>> getRecentQueries(
            @RequestParam(defaultValue = "10") int limit) {
        logger.debug("Getting {} recent queries", limit);
        
        try {
            List<QueryResponse> queries = queryService.getRecentQueries(limit);
            return ResponseEntity.ok(queries);
        } catch (Exception e) {
            logger.error("Error getting recent queries", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * List currently running queries
     */
    @GetMapping("/running")
    public ResponseEntity<List<QueryResponse>> getRunningQueries() {
        logger.debug("Getting running queries");
        
        try {
            List<QueryResponse> queries = queryService.getRunningQueries();
            return ResponseEntity.ok(queries);
        } catch (Exception e) {
            logger.error("Error getting running queries", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Cancel a query
     */
    @DeleteMapping("/{queryId}")
    public ResponseEntity<Void> cancelQuery(@PathVariable String queryId) {
        logger.info("Cancelling query: {}", queryId);
        
        try {
            boolean cancelled = queryService.cancelQuery(queryId);
            if (cancelled) {
                return ResponseEntity.ok().build();
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            logger.error("Error cancelling query: {}", queryId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Validate a SQL query without executing it
     */
    @PostMapping("/validate")
    public ResponseEntity<QueryService.SqlValidationResult> validateQuery(@Valid @RequestBody QueryRequest request) {
        logger.debug("Validating SQL query");
        
        try {
            QueryService.SqlValidationResult result = queryService.validateQuery(request.getSql());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Error validating query", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Check if a SQL query uses supported features
     */
    @PostMapping("/check-support")
    public ResponseEntity<SupportCheckResult> checkQuerySupport(@Valid @RequestBody QueryRequest request) {
        logger.debug("Checking query feature support");
        
        try {
            boolean supported = queryService.isQuerySupported(request.getSql());
            String reason = supported ? "Query uses only supported features" : 
                          queryService.getUnsupportedFeatureReason(request.getSql());
            
            SupportCheckResult result = new SupportCheckResult(supported, reason);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Error checking query support", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Get query execution statistics
     */
    @GetMapping("/stats")
    public ResponseEntity<QueryService.QueryStats> getQueryStats() {
        logger.debug("Getting query statistics");
        
        try {
            QueryService.QueryStats stats = queryService.getQueryStats();
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            logger.error("Error getting query statistics", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Get query results data
     */
    @GetMapping("/{queryId}/results")
    public ResponseEntity<QueryResultService.QueryResult> getQueryResults(@PathVariable String queryId) {
        logger.debug("Getting results for query: {}", queryId);
        
        try {
            QueryResultService.QueryResult results = queryResultService.getResults(queryId);
            if (results != null) {
                return ResponseEntity.ok(results);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            logger.error("Error getting query results for: {}", queryId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Check if query results are available
     */
    @GetMapping("/{queryId}/results/available")
    public ResponseEntity<Map<String, Boolean>> checkResultsAvailable(@PathVariable String queryId) {
        logger.debug("Checking if results are available for query: {}", queryId);
        
        try {
            boolean available = queryResultService.hasResults(queryId);
            Map<String, Boolean> response = new HashMap<>();
            response.put("available", available);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error checking results availability for: {}", queryId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Inner class for support check results
     */
    public static class SupportCheckResult {
        private final boolean supported;
        private final String reason;
        
        public SupportCheckResult(boolean supported, String reason) {
            this.supported = supported;
            this.reason = reason;
        }
        
        public boolean isSupported() { return supported; }
        public String getReason() { return reason; }
    }
}