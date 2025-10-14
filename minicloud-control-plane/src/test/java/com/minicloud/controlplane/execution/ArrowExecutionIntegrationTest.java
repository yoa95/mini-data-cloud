package com.minicloud.controlplane.execution;

import com.minicloud.controlplane.dto.QueryRequest;
import com.minicloud.controlplane.dto.QueryResponse;
import com.minicloud.controlplane.service.QueryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration test to verify Arrow execution engine is properly integrated
 */
@SpringBootTest
@ActiveProfiles("test")
class ArrowExecutionIntegrationTest {
    
    @Autowired
    private QueryService queryService;
    
    @Autowired
    private ArrowQueryExecutionEngine arrowExecutionEngine;
    
    @Test
    void testArrowExecutionEngineIsInjected() {
        // Verify that the Arrow execution engine is properly injected
        assertNotNull(arrowExecutionEngine, "Arrow execution engine should be injected");
    }
    
    @Test
    void testQueryServiceIntegration() {
        // Test that QueryService can handle a simple query
        QueryRequest request = new QueryRequest();
        request.setSql("SELECT id, name FROM test_table WHERE amount > 100");
        
        QueryResponse response = queryService.submitQuery(request);
        
        assertNotNull(response, "Query response should not be null");
        assertNotNull(response.getQueryId(), "Query ID should be generated");
        
        // The query should either succeed or fail with a proper error message
        // (it may fail due to missing table, but should not crash)
        assertTrue(response.getStatus() != null, "Query status should be set");
    }
    
    @Test
    void testSqlValidation() {
        // Test SQL validation functionality with a simple query
        QueryService.SqlValidationResult result = queryService.validateQuery(
            "SELECT 1 as test_column");
        
        assertNotNull(result, "Validation result should not be null");
        // Simple SELECT with literal should be valid
        assertTrue(result.isValid(), "Simple SELECT query should be valid");
    }
    
    @Test
    void testInvalidSqlValidation() {
        // Test validation of invalid SQL
        QueryService.SqlValidationResult result = queryService.validateQuery(
            "INVALID SQL SYNTAX");
        
        assertNotNull(result, "Validation result should not be null");
        assertFalse(result.isValid(), "Invalid SQL should be rejected");
        assertNotNull(result.getMessage(), "Error message should be provided");
    }
}