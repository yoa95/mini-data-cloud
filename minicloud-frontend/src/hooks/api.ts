// Modern React hooks for API operations using React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  QueryRequest,
  QueryHistoryItem,
} from '../types/api';
import { api } from '../lib/api';

// Query keys for cache management
export const queryKeys = {
  tables: ['tables'] as const,
  table: (name: string) => ['tables', name] as const,
  queryHistory: ['query', 'history'] as const,
  clusterStatus: ['monitoring', 'cluster'] as const,
  health: ['health'] as const,
} as const;

// Tables hooks
export const useTables = () => {
  return useQuery({
    queryKey: queryKeys.tables,
    queryFn: api.tables.list,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useTable = (tableName: string) => {
  return useQuery({
    queryKey: queryKeys.table(tableName),
    queryFn: () => api.tables.getDetails(tableName),
    enabled: Boolean(tableName),
    staleTime: 5 * 60 * 1000,
  });
};

export const useTableSample = (tableName: string, limit: number = 10) => {
  return useQuery({
    queryKey: [...queryKeys.table(tableName), 'sample', limit],
    queryFn: () => api.tables.getSample(tableName, limit),
    enabled: Boolean(tableName),
    staleTime: 10 * 60 * 1000, // 10 minutes - sample data doesn't change often
  });
};

// Query hooks
export const useExecuteQuery = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.query.execute,
    onSuccess: () => {
      // Invalidate query history to refresh it
      queryClient.invalidateQueries({ queryKey: queryKeys.queryHistory });
    },
  });
};

export const useQueryHistory = () => {
  return useQuery({
    queryKey: queryKeys.queryHistory,
    queryFn: api.query.getHistory,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Upload hooks
export const useUploadFile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (progress: number) => void }) =>
      api.data.uploadFile(file, onProgress),
    onSuccess: () => {
      // Invalidate tables list to show new table
      queryClient.invalidateQueries({ queryKey: queryKeys.tables });
    },
  });
};

// Monitoring hooks
export const useClusterStatus = (options?: { refetchInterval?: number }) => {
  return useQuery({
    queryKey: queryKeys.clusterStatus,
    queryFn: api.monitoring.getClusterStatus,
    refetchInterval: options?.refetchInterval || 30000, // 30 seconds
    staleTime: 10 * 1000, // 10 seconds
  });
};

// Health check hook
export const useHealthCheck = () => {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: api.health.check,
    refetchInterval: 60000, // 1 minute
    retry: 3,
  });
};

// Custom hook for optimistic updates
export const useOptimisticQuery = () => {
  const queryClient = useQueryClient();
  const executeQuery = useExecuteQuery();

  const executeWithOptimisticUpdate = async (queryRequest: QueryRequest) => {
    // Add to query history optimistically
    const previousHistory = queryClient.getQueryData<QueryHistoryItem[]>(queryKeys.queryHistory);
    
    const optimisticItem: QueryHistoryItem = {
      id: `temp-${Date.now()}`,
      sql: queryRequest.sql,
      executedAt: new Date(),
      executionTime: 0,
      status: 'success', // Optimistic
    };

    queryClient.setQueryData<QueryHistoryItem[]>(
      queryKeys.queryHistory,
      old => [optimisticItem, ...(old || [])]
    );

    try {
      const result = await executeQuery.mutateAsync(queryRequest);
      return result;
    } catch (error) {
      // Revert optimistic update on error
      queryClient.setQueryData(queryKeys.queryHistory, previousHistory);
      throw error;
    }
  };

  return {
    ...executeQuery,
    executeWithOptimisticUpdate,
  };
};