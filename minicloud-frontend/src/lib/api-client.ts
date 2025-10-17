import type {
  QueryRequest,
  QueryResponse,
  QueryResult,
  QueryValidationResult,
  SupportCheckResult,
  QueryStats,
  TableInfo,
  RegisterTableRequest,
  UpdateStatsRequest,
  RegistryStats,
  WorkerInfo,
  ClusterStats,
  SystemHealth,
  ApiError,
  UserFriendlyError,
} from '@/types/api';

// Configuration
const API_BASE_URL = import.meta.env['VITE_API_BASE_URL'] || 'http://localhost:8080';
const API_TIMEOUT = 30000; // 30 seconds

// Custom error class for API errors
export class ApiClientError extends Error {
  public status: number;
  public code: string;
  public details?: Record<string, any>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Retry configuration
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2,
};

// Sleep utility for retry delays
const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

// Calculate exponential backoff delay
const calculateDelay = (attempt: number, config: RetryConfig): number => {
  const delay = config.baseDelay * Math.pow(config.backoffFactor, attempt - 1);
  return Math.min(delay, config.maxDelay);
};

// Check if error is retryable
const isRetryableError = (error: ApiClientError): boolean => {
  // Retry on network errors, 5xx errors, and specific 4xx errors
  return (
    error.status >= 500 ||
    error.status === 408 || // Request Timeout
    error.status === 429 || // Too Many Requests
    error.status === 0      // Network error
  );
};

// Main API client class
export class ApiClient {
  private baseURL: string;
  private timeout: number;
  private retryConfig: RetryConfig;

  constructor(
    baseURL: string = API_BASE_URL,
    timeout: number = API_TIMEOUT,
    retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
  ) {
    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = timeout;
    this.retryConfig = retryConfig;
  }

  // Generic request method with retry logic and error handling
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryConfig: RetryConfig = this.retryConfig
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const requestOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
      ...options,
    };

    let lastError: ApiClientError;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        const response = await fetch(url, requestOptions);
        clearTimeout(timeoutId);

        // Handle different response types
        if (!response.ok) {
          let errorData: ApiError | null = null;
          
          try {
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
              errorData = await response.json();
            }
          } catch {
            // Ignore JSON parsing errors for error responses
          }

          throw new ApiClientError(
            response.status,
            errorData?.code || `HTTP_${response.status}`,
            errorData?.message || response.statusText,
            errorData?.details
          );
        }

        // Handle empty responses (204 No Content, etc.)
        const contentType = response.headers.get('content-type');
        if (response.status === 204 || !contentType?.includes('application/json')) {
          return {} as T;
        }

        const data = await response.json();
        return data;

      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof ApiClientError) {
          lastError = error;
        } else if (error instanceof Error) {
          if (error.name === 'AbortError') {
            lastError = new ApiClientError(0, 'TIMEOUT', 'Request timeout');
          } else {
            lastError = new ApiClientError(0, 'NETWORK_ERROR', error.message);
          }
        } else {
          lastError = new ApiClientError(0, 'UNKNOWN_ERROR', 'Unknown error occurred');
        }

        // Don't retry on the last attempt or non-retryable errors
        if (attempt === retryConfig.maxAttempts || !isRetryableError(lastError)) {
          throw lastError;
        }

        // Wait before retrying
        const delay = calculateDelay(attempt, retryConfig);
        await sleep(delay);
      }
    }

    throw lastError!;
  }

  // Query API methods
  async submitQuery(request: QueryRequest): Promise<QueryResponse> {
    return this.request<QueryResponse>('/api/v1/queries', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getQueryStatus(queryId: string): Promise<QueryResponse> {
    return this.request<QueryResponse>(`/api/v1/queries/${queryId}`);
  }

  async getQueryResults(queryId: string): Promise<QueryResult> {
    return this.request<QueryResult>(`/api/v1/queries/${queryId}/results`);
  }

  async getRecentQueries(limit: number = 10): Promise<QueryResponse[]> {
    return this.request<QueryResponse[]>(`/api/v1/queries?limit=${limit}`);
  }

  async getRunningQueries(): Promise<QueryResponse[]> {
    return this.request<QueryResponse[]>('/api/v1/queries/running');
  }

  async cancelQuery(queryId: string): Promise<void> {
    return this.request<void>(`/api/v1/queries/${queryId}`, {
      method: 'DELETE',
    });
  }

  async validateQuery(request: QueryRequest): Promise<QueryValidationResult> {
    return this.request<QueryValidationResult>('/api/v1/queries/validate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async checkQuerySupport(request: QueryRequest): Promise<SupportCheckResult> {
    return this.request<SupportCheckResult>('/api/v1/queries/check-support', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getQueryStats(): Promise<QueryStats> {
    return this.request<QueryStats>('/api/v1/queries/stats');
  }

  async checkResultsAvailable(queryId: string): Promise<{ available: boolean }> {
    return this.request<{ available: boolean }>(`/api/v1/queries/${queryId}/results/available`);
  }

  // Metadata API methods
  async listAllTables(): Promise<TableInfo[]> {
    return this.request<TableInfo[]>('/api/v1/metadata/tables');
  }

  async listTablesInNamespace(namespaceName: string): Promise<TableInfo[]> {
    return this.request<TableInfo[]>(`/api/v1/metadata/namespaces/${namespaceName}/tables`);
  }

  async getTable(namespaceName: string, tableName: string): Promise<TableInfo> {
    return this.request<TableInfo>(`/api/v1/metadata/namespaces/${namespaceName}/tables/${tableName}`);
  }

  async registerTable(
    namespaceName: string,
    tableName: string,
    request: RegisterTableRequest
  ): Promise<TableInfo> {
    return this.request<TableInfo>(
      `/api/v1/metadata/namespaces/${namespaceName}/tables/${tableName}`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  }

  async deleteTable(namespaceName: string, tableName: string): Promise<void> {
    return this.request<void>(`/api/v1/metadata/namespaces/${namespaceName}/tables/${tableName}`, {
      method: 'DELETE',
    });
  }

  async updateTableStats(
    namespaceName: string,
    tableName: string,
    request: UpdateStatsRequest
  ): Promise<void> {
    return this.request<void>(
      `/api/v1/metadata/namespaces/${namespaceName}/tables/${tableName}/stats`,
      {
        method: 'PUT',
        body: JSON.stringify(request),
      }
    );
  }

  async getRegistryStats(): Promise<RegistryStats> {
    return this.request<RegistryStats>('/api/v1/metadata/stats');
  }

  // Worker API methods
  async getWorkers(status?: string): Promise<WorkerInfo[]> {
    const params = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request<WorkerInfo[]>(`/api/workers${params}`);
  }

  async getWorker(workerId: string): Promise<WorkerInfo> {
    return this.request<WorkerInfo>(`/api/workers/${workerId}`);
  }

  async getClusterStats(): Promise<ClusterStats> {
    return this.request<ClusterStats>('/api/workers/stats');
  }

  async getHealthyWorkers(): Promise<WorkerInfo[]> {
    return this.request<WorkerInfo[]>('/api/workers/healthy');
  }

  // System Health methods (assuming these endpoints exist)
  async getSystemHealth(): Promise<SystemHealth> {
    return this.request<SystemHealth>('/actuator/health');
  }

  // Data Loading methods (assuming these endpoints exist)
  async uploadFile(file: File, onProgress?: (progress: number) => void): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    // For file uploads, we don't use JSON and need to handle progress
    const xhr = new XMLHttpRequest();
    
    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch {
            resolve({});
          }
        } else {
          reject(new ApiClientError(xhr.status, 'UPLOAD_ERROR', xhr.statusText));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new ApiClientError(0, 'NETWORK_ERROR', 'Upload failed'));
      });

      xhr.addEventListener('timeout', () => {
        reject(new ApiClientError(0, 'TIMEOUT', 'Upload timeout'));
      });

      xhr.open('POST', `${this.baseURL}/api/v1/data/upload`);
      xhr.timeout = this.timeout;
      xhr.send(formData);
    });
  }
}

// Error handler utility
export class ApiErrorHandler {
  static handleError(error: ApiClientError): UserFriendlyError {
    switch (error.code) {
      case 'QUERY_TIMEOUT':
        return {
          title: 'Query Timeout',
          message: 'Your query took too long to execute. Try simplifying it or adding filters.',
          actions: ['retry', 'modify-query']
        };
      case 'WORKER_UNAVAILABLE':
        return {
          title: 'System Busy',
          message: 'All workers are currently busy. Please try again in a moment.',
          actions: ['retry', 'wait']
        };
      case 'INVALID_SQL':
        return {
          title: 'SQL Syntax Error',
          message: error.message,
          actions: ['fix-syntax', 'get-help']
        };
      case 'TIMEOUT':
        return {
          title: 'Request Timeout',
          message: 'The request took too long to complete. Please try again.',
          actions: ['retry']
        };
      case 'NETWORK_ERROR':
        return {
          title: 'Connection Error',
          message: 'Unable to connect to the server. Please check your connection.',
          actions: ['retry', 'check-connection']
        };
      default:
        return {
          title: 'Unexpected Error',
          message: error.message || 'Something went wrong. Please try again or contact support.',
          actions: ['retry', 'report-issue']
        };
    }
  }
}

// Create default instance
export const apiClient = new ApiClient();