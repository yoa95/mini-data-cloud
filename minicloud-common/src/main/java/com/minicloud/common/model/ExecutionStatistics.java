package com.minicloud.common.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Duration;
import java.util.Objects;

/**
 * Statistics about query execution performance
 */
public class ExecutionStatistics {
    private final long rowsProcessed;
    private final long bytesProcessed;
    private final Duration executionTime;
    private final Duration cpuTime;
    private final long memoryPeakMb;
    private final long networkBytesSent;
    private final long networkBytesReceived;
    private final int workersUsed;

    @JsonCreator
    public ExecutionStatistics(
            @JsonProperty("rowsProcessed") long rowsProcessed,
            @JsonProperty("bytesProcessed") long bytesProcessed,
            @JsonProperty("executionTime") Duration executionTime,
            @JsonProperty("cpuTime") Duration cpuTime,
            @JsonProperty("memoryPeakMb") long memoryPeakMb,
            @JsonProperty("networkBytesSent") long networkBytesSent,
            @JsonProperty("networkBytesReceived") long networkBytesReceived,
            @JsonProperty("workersUsed") int workersUsed) {
        this.rowsProcessed = rowsProcessed;
        this.bytesProcessed = bytesProcessed;
        this.executionTime = Objects.requireNonNull(executionTime);
        this.cpuTime = cpuTime;
        this.memoryPeakMb = memoryPeakMb;
        this.networkBytesSent = networkBytesSent;
        this.networkBytesReceived = networkBytesReceived;
        this.workersUsed = workersUsed;
    }

    public static ExecutionStatistics empty() {
        return new ExecutionStatistics(0, 0, Duration.ZERO, Duration.ZERO, 0, 0, 0, 0);
    }

    public long getRowsProcessed() {
        return rowsProcessed;
    }

    public long getBytesProcessed() {
        return bytesProcessed;
    }

    public Duration getExecutionTime() {
        return executionTime;
    }

    public Duration getCpuTime() {
        return cpuTime;
    }

    public long getMemoryPeakMb() {
        return memoryPeakMb;
    }

    public long getNetworkBytesSent() {
        return networkBytesSent;
    }

    public long getNetworkBytesReceived() {
        return networkBytesReceived;
    }

    public int getWorkersUsed() {
        return workersUsed;
    }

    public ExecutionStatistics add(ExecutionStatistics other) {
        return new ExecutionStatistics(
                this.rowsProcessed + other.rowsProcessed,
                this.bytesProcessed + other.bytesProcessed,
                this.executionTime.plus(other.executionTime),
                this.cpuTime != null && other.cpuTime != null ? 
                    this.cpuTime.plus(other.cpuTime) : null,
                Math.max(this.memoryPeakMb, other.memoryPeakMb),
                this.networkBytesSent + other.networkBytesSent,
                this.networkBytesReceived + other.networkBytesReceived,
                Math.max(this.workersUsed, other.workersUsed)
        );
    }

    @Override
    public String toString() {
        return "ExecutionStatistics{" +
                "rowsProcessed=" + rowsProcessed +
                ", bytesProcessed=" + bytesProcessed +
                ", executionTime=" + executionTime +
                ", workersUsed=" + workersUsed +
                '}';
    }
}