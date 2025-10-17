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
  TableInfo,
  RegisterTableRequest,
  UpdateStatsRequest,
  RegistryStats,
} from '@/types/api';

// Metadata and table management hooks

export const useAllTables = (
  options?: Omit<UseQueryOptions<TableInfo[], ApiClientError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.allTables(),
    queryFn: () => apiClient.listAllTables(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    ...options,
  });
};

export const useNamespaceTables = (
  namespaceName: string,
  options?: Omit<UseQueryOptions<TableInfo[], ApiClientError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.namespaceTables(namespaceName),
    queryFn: () => apiClient.listTablesInNamespace(namespaceName),
    enabled: !!namespaceName,
    staleTime: 2 * 60 * 1000, // 2 minutes
    ...options,
  });
};

export const useTable = (
  namespaceName: string,
  tableName: string,
  options?: Omit<UseQueryOptions<TableInfo, ApiClientError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.table(namespaceName, tableName),
    queryFn: () => apiClient.getTable(namespaceName, tableName),
    enabled: !!namespaceName && !!tableName,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

export const useRegisterTable = (
  options?: UseMutationOptions<
    TableInfo,
    ApiClientError,
    { namespaceName: string; tableName: string; request: RegisterTableRequest }
  >
) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ namespaceName, tableName, request }) =>
      apiClient.registerTable(namespaceName, tableName, request),
    onSuccess: (data, variables) => {
      // Update the specific table cache
      queryClient.setQueryData(
        queryKeys.table(variables.namespaceName, variables.tableName),
        data
      );
      
      // Invalidate related queries
      invalidationPatterns.tableData(variables.namespaceName, variables.tableName).forEach(pattern => {
        queryClient.invalidateQueries({ queryKey: pattern });
      });
    },
    ...options,
  });
};

export const useDeleteTable = (
  options?: UseMutationOptions<
    void,
    ApiClientError,
    { namespaceName: string; tableName: string }
  >
) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ namespaceName, tableName }) =>
      apiClient.deleteTable(namespaceName, tableName),
    onMutate: async ({ namespaceName, tableName }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ 
        queryKey: queryKeys.table(namespaceName, tableName) 
      });
      
      // Snapshot previous value
      const previousTable = queryClient.getQueryData(
        queryKeys.table(namespaceName, tableName)
      );
      
      // Optimistically remove from cache
      queryClient.removeQueries({ 
        queryKey: queryKeys.table(namespaceName, tableName) 
      });
      
      return { previousTable, namespaceName, tableName };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousTable) {
        queryClient.setQueryData(
          queryKeys.table(context.namespaceName, context.tableName),
          context.previousTable
        );
      }
    },
    onSettled: (data, error, variables) => {
      // Invalidate related queries
      invalidationPatterns.tableData(variables.namespaceName, variables.tableName).forEach(pattern => {
        queryClient.invalidateQueries({ queryKey: pattern });
      });
    },
    ...options,
  });
};

export const useUpdateTableStats = (
  options?: UseMutationOptions<
    void,
    ApiClientError,
    { namespaceName: string; tableName: string; request: UpdateStatsRequest }
  >
) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ namespaceName, tableName, request }) =>
      apiClient.updateTableStats(namespaceName, tableName, request),
    onSuccess: (data, variables) => {
      // Update the table data with new stats
      queryClient.setQueryData(
        queryKeys.table(variables.namespaceName, variables.tableName),
        (old: TableInfo | undefined) => {
          if (!old) return old;
          return {
            ...old,
            rowCount: variables.request.rowCount,
            dataSizeBytes: variables.request.dataSizeBytes,
            updatedAt: new Date().toISOString(),
          };
        }
      );
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.allTables() });
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.namespaceTables(variables.namespaceName) 
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.registryStats() });
    },
    ...options,
  });
};

export const useRegistryStats = (
  options?: Omit<UseQueryOptions<RegistryStats, ApiClientError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.registryStats(),
    queryFn: () => apiClient.getRegistryStats(),
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 30000, // Refresh every 30 seconds
    ...options,
  });
};

// Utility hooks for common metadata operations

export const useTableExists = (namespaceName: string, tableName: string) => {
  const { data: table, isLoading, error } = useTable(namespaceName, tableName, {
    retry: false, // Don't retry for existence checks
  });
  
  return {
    exists: !!table && !error,
    isLoading,
    table,
  };
};

export const useNamespaces = () => {
  const { data: tables, ...rest } = useAllTables();
  
  const namespaces = tables?.reduce((acc, table) => {
    if (!acc.includes(table.namespaceName)) {
      acc.push(table.namespaceName);
    }
    return acc;
  }, [] as string[]) || [];
  
  return {
    data: namespaces,
    ...rest,
  };
};

export const useTablesByNamespace = () => {
  const { data: tables, ...rest } = useAllTables();
  
  const tablesByNamespace = tables?.reduce((acc, table) => {
    if (!acc[table.namespaceName]) {
      acc[table.namespaceName] = [];
    }
    acc[table.namespaceName].push(table);
    return acc;
  }, {} as Record<string, TableInfo[]>) || {};
  
  return {
    data: tablesByNamespace,
    ...rest,
  };
};

export const useTableSearch = (searchTerm: string) => {
  const { data: tables, ...rest } = useAllTables();
  
  const filteredTables = tables?.filter(table => {
    const fullName = `${table.namespaceName}.${table.tableName}`.toLowerCase();
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || 
           table.tableName.toLowerCase().includes(search) ||
           table.namespaceName.toLowerCase().includes(search);
  }) || [];
  
  return {
    data: filteredTables,
    ...rest,
  };
};