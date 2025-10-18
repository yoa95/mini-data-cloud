// Environment configuration for Mini Data Cloud API

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

// Default configuration
const defaultConfig: ApiConfig = {
  baseUrl: import.meta.env.DEV ? "" : "http://localhost:8080", // Use proxy in dev, direct in prod
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
};

// Environment-based configuration
export const getApiConfig = (): ApiConfig => {
  return {
    baseUrl: import.meta.env.VITE_API_BASE_URL || defaultConfig.baseUrl,
    timeout: parseInt(
      import.meta.env.VITE_API_TIMEOUT || String(defaultConfig.timeout)
    ),
    retryAttempts: parseInt(
      import.meta.env.VITE_API_RETRY_ATTEMPTS ||
        String(defaultConfig.retryAttempts)
    ),
    retryDelay: parseInt(
      import.meta.env.VITE_API_RETRY_DELAY || String(defaultConfig.retryDelay)
    ),
  };
};

// API endpoints
export const API_ENDPOINTS = {
  // Data loading endpoints
  UPLOAD_FILE: "/api/v1/data/upload",

  // Metadata endpoints
  TABLES: "/api/v1/metadata/tables",
  TABLE_DETAILS: (tableName: string) => `/api/v1/metadata/tables/${tableName}`,
  TABLE_SAMPLE: (tableName: string, limit?: number) => 
    `/api/v1/metadata/tables/${tableName}/sample${limit ? `?limit=${limit}` : ''}`,

  // Query endpoints
  EXECUTE_QUERY: "/api/v1/queries",
  QUERY_HISTORY: "/api/v1/queries/history",

  // Monitoring endpoints
  CLUSTER_STATUS: "/api/v1/monitoring/cluster",
  WORKER_STATUS: "/api/v1/monitoring/workers",

  // Health check
  HEALTH: "/api/health",
} as const;
