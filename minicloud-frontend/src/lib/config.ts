// Environment configuration for Mini Data Cloud API

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

// Default configuration
const defaultConfig: ApiConfig = {
  baseUrl: 'http://localhost:8080',
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
};

// Environment-based configuration
export const getApiConfig = (): ApiConfig => {
  return {
    baseUrl: import.meta.env.VITE_API_BASE_URL || defaultConfig.baseUrl,
    timeout: parseInt(import.meta.env.VITE_API_TIMEOUT || String(defaultConfig.timeout)),
    retryAttempts: parseInt(import.meta.env.VITE_API_RETRY_ATTEMPTS || String(defaultConfig.retryAttempts)),
    retryDelay: parseInt(import.meta.env.VITE_API_RETRY_DELAY || String(defaultConfig.retryDelay)),
  };
};

// API endpoints
export const API_ENDPOINTS = {
  // Data loading endpoints
  UPLOAD_FILE: '/api/data/upload',
  
  // Metadata endpoints
  TABLES: '/api/metadata/tables',
  TABLE_DETAILS: (tableName: string) => `/api/metadata/tables/${tableName}`,
  
  // Query endpoints
  EXECUTE_QUERY: '/api/query/execute',
  QUERY_HISTORY: '/api/query/history',
  
  // Monitoring endpoints
  CLUSTER_STATUS: '/api/monitoring/cluster',
  WORKER_STATUS: '/api/monitoring/workers',
  
  // Health check
  HEALTH: '/api/health',
} as const;