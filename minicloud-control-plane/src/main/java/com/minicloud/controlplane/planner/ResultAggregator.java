package com.minicloud.controlplane.planner;

import com.minicloud.controlplane.planner.QueryScheduler.StageExecutionResult;
import com.minicloud.controlplane.planner.QueryScheduler.QueryResult;
import com.minicloud.proto.common.CommonProto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Aggregates results from multiple workers executing different stages of a distributed query.
 * Handles result collection, merging, and final result assembly.
 */
@Component
public class ResultAggregator {
    
    private static final Logger logger = LoggerFactory.getLogger(ResultAggregator.class);
    
    /**
     * Aggregate results from multiple stage executions into a final query result
     */
    public QueryResult aggregateResults(String queryId, List<StageExecutionResult> stageResults) {
        logger.info("Aggregating results from {} stages for query {}", stageResults.size(), queryId);
        
        if (stageResults.isEmpty()) {
            logger.warn("No stage results to aggregate for query {}", queryId);
            return createEmptyResult();
        }
        
        // Filter successful results
        List<StageExecutionResult> successfulResults = stageResults.stream()
                .filter(StageExecutionResult::isSuccess)
                .collect(Collectors.toList());
        
        if (successfulResults.isEmpty()) {
            logger.error("No successful stage results for query {}", queryId);
            return createEmptyResult();
        }
        
        logger.debug("Aggregating {} successful stage results", successfulResults.size());
        
        // For now, create mock aggregated results
        // In a real implementation, this would:
        // 1. Fetch actual results from result locations (Arrow Flight endpoints)
        // 2. Merge/union results based on query semantics
        // 3. Apply final aggregations, sorts, limits, etc.
        
        return createMockAggregatedResult(queryId, successfulResults);
    }
    
    /**
     * Aggregate execution statistics from multiple stages
     */
    public AggregatedStats aggregateStats(List<StageExecutionResult> stageResults) {
        long totalRowsProcessed = 0;
        long totalBytesProcessed = 0;
        long totalExecutionTime = 0;
        long totalCpuTime = 0;
        long peakMemoryMb = 0;
        long totalNetworkBytes = 0;
        
        for (StageExecutionResult result : stageResults) {
            if (result.isSuccess() && result.getStats() != null) {
                CommonProto.ExecutionStats stats = result.getStats();
                totalRowsProcessed += stats.getRowsProcessed();
                totalBytesProcessed += stats.getBytesProcessed();
                totalExecutionTime += stats.getExecutionTimeMs();
                totalCpuTime += stats.getCpuTimeMs();
                peakMemoryMb = Math.max(peakMemoryMb, stats.getMemoryPeakMb());
                totalNetworkBytes += stats.getNetworkBytesSent() + stats.getNetworkBytesReceived();
            }
        }
        
        return new AggregatedStats(
                totalRowsProcessed,
                totalBytesProcessed,
                totalExecutionTime,
                totalCpuTime,
                peakMemoryMb,
                totalNetworkBytes,
                stageResults.size()
        );
    }
    
    /**
     * Create an empty result for failed aggregations
     */
    private QueryResult createEmptyResult() {
        return new QueryResult(List.of(), List.of());
    }
    
    /**
     * Create mock aggregated results for demonstration
     * In a real implementation, this would fetch and merge actual results
     */
    private QueryResult createMockAggregatedResult(String queryId, List<StageExecutionResult> results) {
        logger.debug("Creating mock aggregated result for query {}", queryId);
        
        // Calculate total rows from all stages
        long totalRows = results.stream()
                .filter(r -> r.getStats() != null)
                .mapToLong(r -> r.getStats().getRowsProcessed())
                .sum();
        
        // Create mock columns based on common analytical queries
        List<String> columns = Arrays.asList("id", "category", "amount", "date", "description");
        
        // Create mock result rows
        List<List<Object>> rows = new ArrayList<>();
        
        // Generate sample rows based on the aggregated row count
        int rowsToGenerate = Math.min((int) totalRows, 100); // Limit to 100 rows for demo
        
        for (int i = 1; i <= rowsToGenerate; i++) {
            List<Object> row = Arrays.asList(
                    i,                                          // id
                    "Category_" + (i % 5 + 1),                // category
                    100.0 + (i * 10.5),                       // amount
                    "2024-01-" + String.format("%02d", i % 28 + 1), // date
                    "Transaction " + i                          // description
            );
            rows.add(row);
        }
        
        logger.info("Created aggregated result with {} columns and {} rows for query {}", 
                   columns.size(), rows.size(), queryId);
        
        return new QueryResult(columns, rows);
    }
    
    /**
     * Merge results from multiple partitions (for operations like UNION)
     */
    public QueryResult mergePartitionResults(List<QueryResult> partitionResults) {
        if (partitionResults.isEmpty()) {
            return createEmptyResult();
        }
        
        if (partitionResults.size() == 1) {
            return partitionResults.get(0);
        }
        
        // Use the columns from the first result (assuming all have same schema)
        List<String> columns = partitionResults.get(0).getColumns();
        
        // Merge all rows
        List<List<Object>> allRows = new ArrayList<>();
        for (QueryResult result : partitionResults) {
            allRows.addAll(result.getRows());
        }
        
        logger.debug("Merged {} partition results into {} total rows", partitionResults.size(), allRows.size());
        
        return new QueryResult(columns, allRows);
    }
    
    /**
     * Apply final aggregations (for operations like GROUP BY, SUM, etc.)
     */
    public QueryResult applyFinalAggregations(QueryResult intermediateResult, AggregationType aggregationType) {
        switch (aggregationType) {
            case COUNT:
                return applyCountAggregation(intermediateResult);
            case SUM:
                return applySumAggregation(intermediateResult);
            case GROUP_BY:
                return applyGroupByAggregation(intermediateResult);
            case NONE:
            default:
                return intermediateResult;
        }
    }
    
    private QueryResult applyCountAggregation(QueryResult result) {
        List<String> columns = List.of("count");
        List<List<Object>> rows = List.of(List.of(result.getTotalRows()));
        return new QueryResult(columns, rows);
    }
    
    private QueryResult applySumAggregation(QueryResult result) {
        // Simplified sum aggregation on the "amount" column
        double sum = result.getRows().stream()
                .filter(row -> row.size() > 2)
                .mapToDouble(row -> {
                    Object value = row.get(2); // Assuming amount is at index 2
                    return value instanceof Number ? ((Number) value).doubleValue() : 0.0;
                })
                .sum();
        
        List<String> columns = List.of("sum_amount");
        List<List<Object>> rows = List.of(List.of(sum));
        return new QueryResult(columns, rows);
    }
    
    private QueryResult applyGroupByAggregation(QueryResult result) {
        // Simplified GROUP BY aggregation on the "category" column
        Map<String, Long> categoryCount = result.getRows().stream()
                .filter(row -> row.size() > 1)
                .collect(Collectors.groupingBy(
                        row -> String.valueOf(row.get(1)), // Assuming category is at index 1
                        Collectors.counting()
                ));
        
        List<String> columns = Arrays.asList("category", "count");
        List<List<Object>> rows = categoryCount.entrySet().stream()
                .map(entry -> Arrays.<Object>asList(entry.getKey(), entry.getValue()))
                .collect(Collectors.toList());
        
        return new QueryResult(columns, rows);
    }
    
    /**
     * Types of aggregations that can be applied
     */
    public enum AggregationType {
        NONE,
        COUNT,
        SUM,
        GROUP_BY
    }
    
    /**
     * Aggregated execution statistics
     */
    public static class AggregatedStats {
        private final long totalRowsProcessed;
        private final long totalBytesProcessed;
        private final long totalExecutionTimeMs;
        private final long totalCpuTimeMs;
        private final long peakMemoryMb;
        private final long totalNetworkBytes;
        private final int stageCount;
        
        public AggregatedStats(long totalRowsProcessed, long totalBytesProcessed, 
                             long totalExecutionTimeMs, long totalCpuTimeMs, 
                             long peakMemoryMb, long totalNetworkBytes, int stageCount) {
            this.totalRowsProcessed = totalRowsProcessed;
            this.totalBytesProcessed = totalBytesProcessed;
            this.totalExecutionTimeMs = totalExecutionTimeMs;
            this.totalCpuTimeMs = totalCpuTimeMs;
            this.peakMemoryMb = peakMemoryMb;
            this.totalNetworkBytes = totalNetworkBytes;
            this.stageCount = stageCount;
        }
        
        // Getters
        public long getTotalRowsProcessed() { return totalRowsProcessed; }
        public long getTotalBytesProcessed() { return totalBytesProcessed; }
        public long getTotalExecutionTimeMs() { return totalExecutionTimeMs; }
        public long getTotalCpuTimeMs() { return totalCpuTimeMs; }
        public long getPeakMemoryMb() { return peakMemoryMb; }
        public long getTotalNetworkBytes() { return totalNetworkBytes; }
        public int getStageCount() { return stageCount; }
        
        @Override
        public String toString() {
            return "AggregatedStats{" +
                    "totalRowsProcessed=" + totalRowsProcessed +
                    ", totalBytesProcessed=" + totalBytesProcessed +
                    ", totalExecutionTimeMs=" + totalExecutionTimeMs +
                    ", totalCpuTimeMs=" + totalCpuTimeMs +
                    ", peakMemoryMb=" + peakMemoryMb +
                    ", totalNetworkBytes=" + totalNetworkBytes +
                    ", stageCount=" + stageCount +
                    '}';
        }
    }
}