import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Play, Square, Download, Clock, Database, Zap, Activity } from 'lucide-react';
import { useSubmitQuery, useCancelQuery, useQueryLifecycle } from '@/hooks/api/queries';
import { useQueryProgress } from '@/hooks/useQueryProgress';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import type { QueryRequest } from '@/types/api';

interface QueryExecutionProps {
  sql: string;
  onQuerySubmitted?: (queryId: string) => void;
  className?: string;
}

export const QueryExecution: React.FC<QueryExecutionProps> = ({
  sql,
  onQuerySubmitted,
  className,
}) => {
  const [currentQueryId, setCurrentQueryId] = useState<string | null>(null);
  const { toast } = useToast();

  // Query mutations
  const submitQuery = useSubmitQuery({
    onSuccess: (response) => {
      setCurrentQueryId(response.queryId);
      onQuerySubmitted?.(response.queryId);
      toast({
        title: 'Query Submitted',
        description: `Query ${response.queryId} has been submitted for execution.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Query Submission Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const cancelQuery = useCancelQuery({
    onSuccess: () => {
      toast({
        title: 'Query Cancelled',
        description: 'The query has been cancelled successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Cancel Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Query lifecycle management
  const {
    query,
    results,
    isRunning,
    isCompleted,
    isFailed,
    isCancelled,
    canCancel,
    hasResults,
    error,
  } = useQueryLifecycle(currentQueryId || '');

  // Real-time progress tracking
  const { progress } = useQueryProgress(currentQueryId, {
    enabled: isRunning,
    onComplete: () => {
      toast({
        title: 'Query Completed',
        description: 'Your query has finished executing successfully.',
        variant: 'success',
      });
    },
    onError: (_, errorMessage) => {
      toast({
        title: 'Query Failed',
        description: errorMessage,
        variant: 'error',
      });
    },
  });

  // Execute query
  const handleExecute = useCallback(() => {
    if (!sql.trim()) {
      toast({
        title: 'Empty Query',
        description: 'Please enter a SQL query to execute.',
        variant: 'destructive',
      });
      return;
    }

    const request: QueryRequest = {
      sql: sql.trim(),
    };

    submitQuery.mutate(request);
  }, [sql, submitQuery, toast]);

  // Cancel query
  const handleCancel = useCallback(() => {
    if (currentQueryId && canCancel) {
      cancelQuery.mutate(currentQueryId);
    }
  }, [currentQueryId, canCancel, cancelQuery]);

  // Export results
  const handleExport = useCallback((format: 'csv' | 'json') => {
    if (!hasResults || !results) return;

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'csv') {
      // Generate CSV
      const headers = results.columns.map(col => col.name).join(',');
      const rows = results.rows.map(row => 
        results.columns.map(col => {
          const value = row[col.name];
          // Escape CSV values
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value ?? '';
        }).join(',')
      );
      content = [headers, ...rows].join('\n');
      filename = `query_results_${currentQueryId}.csv`;
      mimeType = 'text/csv';
    } else {
      // Generate JSON
      content = JSON.stringify({
        queryId: currentQueryId,
        executionTime: results.executionTime,
        totalRows: results.totalRows,
        bytesScanned: results.bytesScanned,
        columns: results.columns,
        rows: results.rows,
      }, null, 2);
      filename = `query_results_${currentQueryId}.json`;
      mimeType = 'application/json';
    }

    // Download file
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Complete',
      description: `Results exported as ${format.toUpperCase()}.`,
    });
  }, [hasResults, results, currentQueryId, toast]);

  // Get status badge variant
  const getStatusVariant = () => {
    if (isRunning) return 'default';
    if (isCompleted) return 'success';
    if (isFailed) return 'destructive';
    if (isCancelled) return 'secondary';
    return 'outline';
  };

  // Get status text
  const getStatusText = () => {
    if (submitQuery.isPending) return 'Submitting...';
    if (isRunning) return 'Running';
    if (isCompleted) return 'Completed';
    if (isFailed) return 'Failed';
    if (isCancelled) return 'Cancelled';
    return 'Ready';
  };

  // Format execution time
  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Format bytes
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button
            onClick={handleExecute}
            disabled={submitQuery.isPending || isRunning || !sql.trim()}
            size="sm"
          >
            {submitQuery.isPending || isRunning ? (
              <LoadingSpinner className="w-4 h-4 mr-2" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Execute
          </Button>

          {canCancel && (
            <Button
              onClick={handleCancel}
              disabled={cancelQuery.isPending}
              variant="outline"
              size="sm"
            >
              <Square className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          )}

          <Badge variant={getStatusVariant()}>
            {getStatusText()}
          </Badge>
        </div>

        {hasResults && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => handleExport('csv')}
              variant="outline"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button
              onClick={() => handleExport('json')}
              variant="outline"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              JSON
            </Button>
          </div>
        )}
      </div>

      {/* Query Information */}
      {query && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>
              {query.executionTimeMs 
                ? `Executed in ${formatExecutionTime(query.executionTimeMs)}`
                : 'Execution time: N/A'
              }
            </span>
          </div>

          {results && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="w-4 h-4" />
                <span>{results.totalRows.toLocaleString()} rows returned</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="w-4 h-4" />
                <span>{formatBytes(results.bytesScanned)} scanned</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Error Display */}
      {(isFailed || error) && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4">
          <p className="text-sm text-destructive font-medium">Query Failed</p>
          <p className="text-sm text-destructive/80 mt-1">
            {query?.errorMessage || error?.message || 'An unknown error occurred'}
          </p>
        </div>
      )}

      {/* Query Progress */}
      {isRunning && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <LoadingSpinner className="w-4 h-4" />
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Query Executing
              </p>
            </div>
            {progress && (
              <Badge variant="outline" className="text-xs">
                {Math.round(progress.progress)}%
              </Badge>
            )}
          </div>

          {/* Progress Bar */}
          {progress && (
            <div className="mb-3">
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                <div
                  className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Progress Details */}
          {progress && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                <Activity className="w-4 h-4" />
                <span>Stage: {progress.stage}</span>
              </div>
              
              {progress.currentWorker && (
                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                  <Database className="w-4 h-4" />
                  <span>Worker: {progress.currentWorker}</span>
                </div>
              )}
              
              {progress.estimatedRemainingMs && (
                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                  <Clock className="w-4 h-4" />
                  <span>
                    Est. remaining: {formatExecutionTime(progress.estimatedRemainingMs)}
                  </span>
                </div>
              )}
              
              {progress.message && (
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  {progress.message}
                </p>
              )}
            </div>
          )}

          {/* Fallback message when no progress data */}
          {!progress && (
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Query is running... This may take a few moments.
            </p>
          )}
        </div>
      )}

      {/* Success Message */}
      {isCompleted && hasResults && (
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md p-3">
          <p className="text-sm text-green-700 dark:text-green-300">
            Query completed successfully! {results?.totalRows.toLocaleString()} rows returned.
          </p>
        </div>
      )}
    </Card>
  );
};

export default QueryExecution;