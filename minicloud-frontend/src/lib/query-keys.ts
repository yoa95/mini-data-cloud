// Query keys factory for TanStack Query
// This ensures consistent cache key management across the application

export const queryKeys = {
  // Query-related keys
  queries: ['queries'] as const,
  query: (id: string) => ['queries', id] as const,
  queryResults: (id: string) => ['queries', id, 'results'] as const,
  queryValidation: (sql: string) => ['queries', 'validation', sql] as const,
  querySupport: (sql: string) => ['queries', 'support', sql] as const,
  queryStats: () => ['queries', 'stats'] as const,
  recentQueries: (limit?: number) => ['queries', 'recent', limit] as const,
  runningQueries: () => ['queries', 'running'] as const,
  resultsAvailable: (id: string) => ['queries', id, 'results-available'] as const,

  // Metadata-related keys
  metadata: ['metadata'] as const,
  tables: ['metadata', 'tables'] as const,
  allTables: () => ['metadata', 'tables', 'all'] as const,
  namespaceTables: (namespace: string) => ['metadata', 'tables', 'namespace', namespace] as const,
  table: (namespace: string, name: string) => ['metadata', 'tables', namespace, name] as const,
  registryStats: () => ['metadata', 'stats'] as const,

  // Worker-related keys
  workers: ['workers'] as const,
  allWorkers: (status?: string) => ['workers', 'all', status] as const,
  worker: (id: string) => ['workers', id] as const,
  healthyWorkers: () => ['workers', 'healthy'] as const,
  clusterStats: () => ['workers', 'cluster-stats'] as const,

  // System-related keys
  system: ['system'] as const,
  systemHealth: () => ['system', 'health'] as const,

  // Data loading keys
  dataLoading: ['data-loading'] as const,
  uploadProgress: (fileId: string) => ['data-loading', 'upload', fileId] as const,
  schemaInference: (fileId: string) => ['data-loading', 'schema', fileId] as const,
} as const;

// Type helpers for query keys
export type QueryKey = typeof queryKeys;

// Utility functions for working with query keys
export const queryKeyUtils = {
  // Check if a key matches a pattern
  matches: (key: readonly unknown[], pattern: readonly unknown[]): boolean => {
    if (pattern.length > key.length) return false;
    return pattern.every((item, index) => key[index] === item);
  },

  // Get all keys that start with a prefix
  getKeysWithPrefix: (keys: readonly unknown[][], prefix: readonly unknown[]): readonly unknown[][] => {
    return keys.filter(key => queryKeyUtils.matches(key, prefix));
  },

  // Create a predicate function for invalidating queries
  createInvalidationPredicate: (patterns: readonly (readonly unknown[])[]): (key: readonly unknown[]) => boolean => {
    return (key: readonly unknown[]) => {
      return patterns.some(pattern => queryKeyUtils.matches(key, pattern));
    };
  },
};

// Common invalidation patterns
export const invalidationPatterns = {
  // Invalidate all query-related data
  allQueries: [queryKeys.queries],
  
  // Invalidate all metadata
  allMetadata: [queryKeys.metadata],
  
  // Invalidate all worker data
  allWorkers: [queryKeys.workers],
  
  // Invalidate system data
  allSystem: [queryKeys.system],
  
  // Invalidate specific query and its results
  queryAndResults: (queryId: string) => [
    queryKeys.query(queryId),
    queryKeys.queryResults(queryId),
    queryKeys.resultsAvailable(queryId),
  ],
  
  // Invalidate table-related data
  tableData: (namespace: string, tableName: string) => [
    queryKeys.table(namespace, tableName),
    queryKeys.namespaceTables(namespace),
    queryKeys.allTables(),
    queryKeys.registryStats(),
  ],
  
  // Invalidate worker-related data
  workerData: (workerId?: string) => {
    const patterns = [
      queryKeys.allWorkers(),
      queryKeys.healthyWorkers(),
      queryKeys.clusterStats(),
    ];
    
    if (workerId) {
      patterns.push(queryKeys.worker(workerId));
    }
    
    return patterns;
  },
} as const;