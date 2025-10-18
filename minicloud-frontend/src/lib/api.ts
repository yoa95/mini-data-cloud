// Modern API layer using the HTTP client
import type {
  Table,
  QueryResult,
  QueryRequest,
  UploadResult,
  ClusterMetrics,
  QueryHistoryItem,
  SampleData,
  BackendTableResponse,
} from "../types/api";
import { httpClient } from "./http-client";
import { API_ENDPOINTS } from "./config";

// Transform backend table response to frontend Table type
const transformBackendTable = (backendTable: BackendTableResponse): Table => {
  return {
    name: backendTable.tableName,
    namespace: backendTable.namespaceName,
    rowCount: backendTable.rowCount,
    fileSize: backendTable.dataSizeBytes,
    lastModified: new Date(backendTable.updatedAt),
    // For now, we'll use an empty schema array since the backend doesn't provide it in the list endpoint
    // This will be populated when we get the table details
    schema: [],
  };
};

// API functions - pure and testable
export const api = {
  // Metadata operations
  tables: {
    list: async (): Promise<Table[]> => {
      const backendTables = await httpClient.get<BackendTableResponse[]>(API_ENDPOINTS.TABLES);
      return backendTables.map(transformBackendTable);
    },

    getDetails: async (tableName: string): Promise<Table> => {
      // First get the basic table info from the list
      const tables = await httpClient.get<BackendTableResponse[]>(API_ENDPOINTS.TABLES);
      const backendTable = tables.find(t => t.tableName === tableName);
      
      if (!backendTable) {
        throw new Error(`Table ${tableName} not found`);
      }

      // Get schema information by querying the table structure
      try {
        const queryResult = await httpClient.post<QueryResult>(API_ENDPOINTS.EXECUTE_QUERY, {
          sql: `SELECT * FROM ${tableName} LIMIT 1`
        });

        // Create schema from query result columns
        const schema = queryResult.columns.map(columnName => ({
          name: columnName,
          type: 'STRING', // We don't have type information, so default to STRING
          nullable: true, // Assume nullable by default
          description: undefined
        }));

        return {
          name: backendTable.tableName,
          namespace: backendTable.namespaceName,
          rowCount: backendTable.rowCount,
          fileSize: backendTable.dataSizeBytes,
          lastModified: new Date(backendTable.updatedAt),
          schema: schema,
        };
      } catch (error) {
        // If query fails, return table without schema
        return transformBackendTable(backendTable);
      }
    },

    getSample: async (tableName: string, limit: number = 10): Promise<SampleData> => {
      try {
        const queryResult = await httpClient.post<QueryResult>(API_ENDPOINTS.EXECUTE_QUERY, {
          sql: `SELECT * FROM ${tableName} LIMIT ${limit}`
        });

        return {
          columns: queryResult.columns,
          rows: queryResult.rows,
          totalRows: queryResult.rowsReturned,
          sampleSize: queryResult.rows.length,
        };
      } catch (error) {
        throw new Error(`Failed to get sample data for table ${tableName}: ${error}`);
      }
    },
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
