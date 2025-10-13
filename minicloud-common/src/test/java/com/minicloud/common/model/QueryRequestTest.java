package com.minicloud.common.model;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import java.util.Map;

class QueryRequestTest {

    @Test
    void testQueryRequestCreation() {
        String sql = "SELECT * FROM test_table";
        QueryRequest request = QueryRequest.of(sql);
        
        assertNotNull(request.getQueryId());
        assertEquals(sql, request.getSql());
        assertNotNull(request.getTraceId());
        assertNotNull(request.getSubmittedAt());
        assertTrue(request.getParameters().isEmpty());
        assertTrue(request.getSessionProperties().isEmpty());
    }

    @Test
    void testQueryRequestWithParameters() {
        String sql = "SELECT * FROM test_table WHERE id = ?";
        Map<String, Object> params = Map.of("id", 123);
        QueryRequest request = QueryRequest.of(sql, params);
        
        assertEquals(sql, request.getSql());
        assertEquals(params, request.getParameters());
    }

    @Test
    void testQueryRequestEquality() {
        String queryId = "test-query-123";
        QueryRequest request1 = new QueryRequest(queryId, "SELECT 1", null, null, null, null);
        QueryRequest request2 = new QueryRequest(queryId, "SELECT 2", null, null, null, null);
        
        assertEquals(request1, request2); // Same queryId
        assertEquals(request1.hashCode(), request2.hashCode());
    }
}