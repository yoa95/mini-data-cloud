import type { 
  Table, 
  QueryResult, 
  QueryRequest, 
  UploadResult, 
  ClusterMetrics, 
  QueryHistoryItem
} from '../types/api';
import { MiniCloudApiError } from '../types/api';
import { getApiConfig, API_ENDPOINTS } from './config';

export class MiniCloudApiClient {
  private config = getApiConfig();
  private authToken: string | null = null;

  constructor() {
    // Initialize auth token from localStorage if available
    this.authToken = localStorage.getItem('minicloud_auth_token');
  }

  // Authentication methods
  setAuthToken(token: string) {
    this.authToken = token;
    localStorage.setItem('minicloud_auth_token', token);
  }

  clearAuthToken() {
    this.authToken = null;
    localStorage.removeItem('minicloud_auth_token');
  }

  // Request interceptor with error handling and retry logic
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    // Default headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Add auth token if available
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const requestOptions: RequestInit = {
      ...options,
      headers,
      signal: AbortSignal.timeout(this.config.timeout),
    };

    try {
      const response = await fetch(url, requestOptions);

      // Handle authentication errors
      if (response.status === 401) {
        this.clearAuthToken();
        throw new MiniCloudApiError('Authentication required', 'AUTH_REQUIRED');
      }

      // Handle other HTTP errors
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          // Use default error message if JSON parsing fails
        }

        throw new MiniCloudApiError(errorMessage, `HTTP_${response.status}`);
      }

      // Parse response
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text() as T;
      }

    } catch (error) {
      // Handle network errors and timeouts
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new MiniCloudApiError('Request timeout', 'TIMEOUT');
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new MiniCloudApiError('Network error', 'NETWORK_ERROR');
      }

      // Retry logic for retryable errors
      if (retryCount < this.config.retryAttempts && this.isRetryableError(error)) {
        await this.delay(this.config.retryDelay * Math.pow(2, retryCount));
        return this.makeRequest(endpoint, options, retryCount + 1);
      }

      // Re-throw MiniCloudApiError instances
      if (error instanceof MiniCloudApiError) {
        throw error;
      }

      // Wrap other errors
      throw new MiniCloudApiError(
        error instanceof Error ? error.message : 'Unknown error',
        'UNKNOWN_ERROR'
      );
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof MiniCloudApiError) {
      return ['TIMEOUT', 'NETWORK_ERROR'].includes(error.code || '');
    }
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // File upload methods
  async uploadFile(
    file: File, 
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);

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
            const result = JSON.parse(xhr.responseText);
            resolve(result);
          } catch {
            resolve({ success: true, message: 'File uploaded successfully' });
          }
        } else {
          reject(new MiniCloudApiError(`Upload failed: ${xhr.statusText}`, `HTTP_${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new MiniCloudApiError('Upload failed', 'UPLOAD_ERROR'));
      });

      xhr.addEventListener('timeout', () => {
        reject(new MiniCloudApiError('Upload timeout', 'TIMEOUT'));
      });

      xhr.open('POST', `${this.config.baseUrl}${API_ENDPOINTS.UPLOAD_FILE}`);
      
      if (this.authToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${this.authToken}`);
      }

      xhr.timeout = this.config.timeout;
      xhr.send(formData);
    });
  }

  // Metadata methods
  async getTables(): Promise<Table[]> {
    return this.makeRequest<Table[]>(API_ENDPOINTS.TABLES);
  }

  async getTableDetails(tableName: string): Promise<Table> {
    return this.makeRequest<Table>(API_ENDPOINTS.TABLE_DETAILS(tableName));
  }

  // Query methods
  async executeQuery(queryRequest: QueryRequest): Promise<QueryResult> {
    return this.makeRequest<QueryResult>(API_ENDPOINTS.EXECUTE_QUERY, {
      method: 'POST',
      body: JSON.stringify(queryRequest),
    });
  }

  async getQueryHistory(): Promise<QueryHistoryItem[]> {
    return this.makeRequest<QueryHistoryItem[]>(API_ENDPOINTS.QUERY_HISTORY);
  }

  // Monitoring methods
  async getClusterStatus(): Promise<ClusterMetrics> {
    return this.makeRequest<ClusterMetrics>(API_ENDPOINTS.CLUSTER_STATUS);
  }

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    return this.makeRequest<{ status: string }>(API_ENDPOINTS.HEALTH);
  }

  // WebSocket connection for real-time metrics (placeholder for future implementation)
  subscribeToMetrics(_callback: (metrics: ClusterMetrics) => void): () => void {
    // TODO: Implement WebSocket connection for real-time updates
    // For now, return a no-op unsubscribe function
    console.warn('Real-time metrics subscription not yet implemented');
    return () => {};
  }
}

// Export singleton instance
export const apiClient = new MiniCloudApiClient();