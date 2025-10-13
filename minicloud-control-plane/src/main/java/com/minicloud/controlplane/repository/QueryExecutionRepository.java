package com.minicloud.controlplane.repository;

import com.minicloud.controlplane.model.QueryExecution;
import com.minicloud.controlplane.model.QueryStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository interface for QueryExecution entities
 */
@Repository
public interface QueryExecutionRepository extends JpaRepository<QueryExecution, Long> {
    
    /**
     * Find query execution by query ID
     */
    Optional<QueryExecution> findByQueryId(String queryId);
    
    /**
     * Find queries by status
     */
    List<QueryExecution> findByStatus(QueryStatus status);
    
    /**
     * Find queries submitted after a certain time
     */
    List<QueryExecution> findBySubmittedAtAfter(LocalDateTime submittedAt);
    
    /**
     * Find running queries (for monitoring)
     */
    @Query("SELECT q FROM QueryExecution q WHERE q.status = 'RUNNING' ORDER BY q.submittedAt ASC")
    List<QueryExecution> findRunningQueries();
    
    /**
     * Find recent queries (last N queries)
     */
    @Query("SELECT q FROM QueryExecution q ORDER BY q.submittedAt DESC")
    List<QueryExecution> findRecentQueries();
    
    /**
     * Get average execution time for completed queries
     */
    @Query("SELECT AVG(q.executionTimeMs) FROM QueryExecution q WHERE q.status = 'COMPLETED' AND q.executionTimeMs IS NOT NULL")
    Double getAverageExecutionTime();
    
    /**
     * Count queries by status
     */
    Long countByStatus(QueryStatus status);
    
    /**
     * Find queries with execution time greater than threshold
     */
    @Query("SELECT q FROM QueryExecution q WHERE q.executionTimeMs > :thresholdMs ORDER BY q.executionTimeMs DESC")
    List<QueryExecution> findSlowQueries(@Param("thresholdMs") Long thresholdMs);
}