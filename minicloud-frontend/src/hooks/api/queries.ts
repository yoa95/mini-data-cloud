import { 
  useQuery, 
  useMutation, 
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { queryKeys, invalidationPatterns } from '@/lib/query-keys';
import type {
  QueryRequest,
  QueryResponse,
  QueryResult,
  QueryValidationResult,
  SupportCheckResult,
  QueryStats,
} from '@/types/api';

// Query submission and management hooks

export const useSubmitQuery = (
  options?: UseMutationOptions<QueryResponse, ApiClientError, QueryRequest>
) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: QueryRequest) => apiClient.submitQuery(request),
    onSuccess: (data) => {
      // Invalidate queries list to show new query
      queryClient.invalidateQueries({ queryKey: queryKeys.queries });
      // Set initial query data
      queryClient.setQueryData(queryKeys.query(data.queryId), data);
      // Invalidate query stats
      queryClient.invalidateQueries({ queryKey: queryKeys.queryStats() });
    },
    ...options,
  });
};

export const useQueryStatus = (
  queryId: string,
  options?: Omit<UseQueryOptions<QueryResponse, ApiClientError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.query(queryId),
    queryFn: () => apiClient.getQueryStatus(queryId),
    enabled: !!queryId,
    refetchInterval: (data) => {
      // Poll while query is running
      return data?.status === 'RUNNING' || data?.status === 'SUBMITTED' ? 1000 : false;
    },
    ...options,
  });
};

export const useQueryResults = (
  queryId: string,
  options?: Omit<UseQueryOptions<QueryResult, ApiClientError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.queryResults(queryId),
    queryFn: () => apiClient.getQueryResults(queryId),
    enabled: !!queryId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

export const useRecentQueries = (
  limit: number = 10,
  options?: Omit<UseQueryOptions<QueryResponse[], ApiClientError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.recentQueries(limit),
    queryFn: () => apiClient.getRecentQueries(limit),
    staleTime: 30 * 1000, // 30 seconds
    ...options,
  });
};

export const useRunningQueries = (
  options?: Omit<UseQueryOptions<QueryResponse[], ApiClientError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.runningQueries(),
    queryFn: () => apiClient.getRunningQueries(),
    refetchInterval: 2000, // Refresh every 2 seconds
    ...options,
  });
};

export const useCancelQuery = (
  options?: UseMutationOptions<void, ApiClientError, string>
) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (queryId: string) => apiClient.cancelQuery(queryId),
    onMutate: async (queryId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.query(queryId) });
      
      // Snapshot previous value
      const previousQuery = queryClient.getQueryData(queryKeys.query(queryId));
      
      // Optimistically update to cancelled state
      queryClient.setQueryData(queryKeys.query(queryId), (old: QueryResponse | undefined) =>
        old ? { ...old, status: 'CANCELLED' as const } : undefined
      );
      
      return { previousQuery };
    },
    onError: (err, queryId, context) => {
      // Rollback on error
      if (context?.previousQuery) {
        queryClient.setQueryData(queryKeys.query(queryId), context.previousQuery);
      }
    },
    onSettled: (data, error, queryId) => {
      // Always refetch after mutation
      queryClient.invalidateQueries({ queryKey: queryKeys.query(queryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.runningQueries() });
      queryClient.invalidateQueries({ queryKey: queryKeys.queryStats() });
    },
    ...options,
  });
};

export const useValidateQuery = (
  sql: string,
  options?: Omit<UseQueryOptions<QueryValidationResult, ApiClientError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.queryValidation(sql),
    queryFn: () => apiClient.validateQuery({ sql }),
    enabled: !!sql && sql.trim().length > 0,
    staleTime: 1 * 60 * 1000, // 1 minute
    ...options,
  });
};

export const useCheckQuerySupport = (
  sql: string,
  options?: Omit<UseQueryOptions<SupportCheckResult, ApiClientError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.querySupport(sql),
    queryFn: () => apiClient.checkQuerySupport({ sql }),
    enabled: !!sql && sql.trim().length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

export const useQueryStats = (
  options?: Omit<UseQueryOptions<QueryStats, ApiClientError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.queryStats(),
    queryFn: () => apiClient.getQueryStats(),
    refetchInterval: 10000, // Refresh every 10 seconds
    ...options,
  });
};

export const useCheckResultsAvailable = (
  queryId: string,
  options?: Omit<UseQueryOptions<{ available: boolean }, ApiClientError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.resultsAvailable(queryId),
    queryFn: () => apiClient.checkResultsAvailable(queryId),
    enabled: !!queryId,
    refetchInterval: (data) => {
      // Stop polling once results are available
      return data?.available ? false : 2000;
    },
    ...options,
  });
};

// Utility hook for managing query lifecycle
export const useQueryLifecycle = (queryId: string) => {
  const queryStatus = useQueryStatus(queryId);
  const queryResults = useQueryResults(queryId, {
    enabled: queryStatus.data?.status === 'COMPLETED',
  });
  const cancelQuery = useCancelQuery();
  
  const isRunning = queryStatus.data?.status === 'RUNNING' || queryStatus.data?.status === 'SUBMITTED';
  const isCompleted = queryStatus.data?.status === 'COMPLETED';
  const isFailed = queryStatus.data?.status === 'FAILED';
  const isCancelled = queryStatus.data?.status === 'CANCELLED';
  
  const canCancel = isRunning && !cancelQuery.isPending;
  const hasResults = isCompleted && queryResults.data;
  
  return {
    query: queryStatus.data,
    results: queryResults.data,
    isLoading: queryStatus.isLoading || queryResults.isLoading,
    isRunning,
    isCompleted,
    isFailed,
    isCancelled,
    canCancel,
    hasResults,
    error: queryStatus.error || queryResults.error,
    cancel: () => cancelQuery.mutate(queryId),
    isCancelling: cancelQuery.isPending,
  };
};