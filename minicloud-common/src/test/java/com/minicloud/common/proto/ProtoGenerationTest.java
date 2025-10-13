package com.minicloud.common.proto;

import com.minicloud.proto.common.CommonProto;
import com.minicloud.proto.execution.QueryExecutionProto;
import com.minicloud.proto.metadata.MetadataProto;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ProtoGenerationTest {

    @Test
    void testCommonProtoGeneration() {
        // Test that common proto classes are generated and accessible
        CommonProto.StandardResponse response = CommonProto.StandardResponse.newBuilder()
                .setStatus(CommonProto.ResponseStatus.SUCCESS)
                .setRequestId("test-123")
                .build();
        
        assertEquals(CommonProto.ResponseStatus.SUCCESS, response.getStatus());
        assertEquals("test-123", response.getRequestId());
    }

    @Test
    void testExecutionProtoGeneration() {
        // Test that execution proto classes are generated
        QueryExecutionProto.ExecuteStageRequest request = QueryExecutionProto.ExecuteStageRequest.newBuilder()
                .setQueryId("query-123")
                .setStageId(1)
                .setTraceId("trace-456")
                .build();
        
        assertEquals("query-123", request.getQueryId());
        assertEquals(1, request.getStageId());
        assertEquals("trace-456", request.getTraceId());
    }

    @Test
    void testMetadataProtoGeneration() {
        // Test that metadata proto classes are generated
        MetadataProto.GetTableRequest request = MetadataProto.GetTableRequest.newBuilder()
                .setNamespaceName("default")
                .setTableName("test_table")
                .build();
        
        assertEquals("default", request.getNamespaceName());
        assertEquals("test_table", request.getTableName());
    }
}