package com.minicloud.controlplane.model;

/**
 * Enumeration of possible query execution statuses
 */
public enum QueryStatus {
    SUBMITTED,
    RUNNING,
    COMPLETED,
    FAILED,
    CANCELLED
}