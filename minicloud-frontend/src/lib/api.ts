// Modern API layer using the HTTP client
import type {
  Table,
  QueryResult,
  QueryRequest,
  UploadResult,
  ClusterMetrics,
  QueryHistoryItem,
} from "../types/api";
import { httpClient } from "./http-client";
import { API_ENDPOINTS } from "./config";

// API functions - pure and testable
export const api = {
  // Metadata operations
  tables: {
    list: (): Promise<Table[]> => httpClient.get<Table[]>(API_ENDPOINTS.TABLES),

    getDetails: (tableName: string): Promise<Table> =>
      httpClient.get<Table>(API_ENDPOINTS.TABLE_DETAILS(tableName)),
  },

  // Query operations
  query: {
    execute: (queryRequest: QueryRequest): Promise<QueryResult> =>
      httpClient.post<QueryResult>(API_ENDPOINTS.EXECUTE_QUERY, queryRequest),

    getHistory: (): Promise<QueryHistoryItem[]> =>
      httpClient.get<QueryHistoryItem[]>(API_ENDPOINTS.QUERY_HISTORY),
  },

  // Data upload operations
  data: {
    uploadFile: async (
      file: File,
      onProgress?: (progress: number) => void
    ): Promise<UploadResult> => {
      // For now, use the basic upload without progress
      // In a real app, you'd implement progress tracking with a custom solution
      const response = await httpClient.uploadFile(
        API_ENDPOINTS.UPLOAD_FILE,
        file,
        onProgress
      );
      return response as unknown as UploadResult;
    },
  },

  // Monitoring operations
  monitoring: {
    getClusterStatus: (): Promise<ClusterMetrics> =>
      httpClient.get<ClusterMetrics>(API_ENDPOINTS.CLUSTER_STATUS),
  },

  // Health check
  health: {
    check: (): Promise<{ status: string }> =>
      httpClient.get<{ status: string }>(API_ENDPOINTS.HEALTH),
  },
} as const;

// Type-safe API client
export type ApiClient = typeof api;
