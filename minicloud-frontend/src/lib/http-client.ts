// Modern HTTP client using fetch with interceptors pattern
import { MiniCloudApiError } from '../types/api';
import { getApiConfig } from './config';

export interface RequestConfig extends RequestInit {
  timeout?: number;
  retries?: number;
}

export interface Interceptors {
  request: ((config: RequestConfig) => RequestConfig | Promise<RequestConfig>)[];
  response: ((response: Response) => Response | Promise<Response>)[];
}

class HttpClient {
  private baseURL: string;
  private defaultTimeout: number;
  private defaultRetries: number;
  private interceptors: Interceptors = { request: [], response: [] };

  constructor() {
    const config = getApiConfig();
    this.baseURL = config.baseUrl;
    this.defaultTimeout = config.timeout;
    this.defaultRetries = config.retryAttempts;
  }

  // Interceptor management
  addRequestInterceptor(interceptor: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>) {
    this.interceptors.request.push(interceptor);
    return () => {
      const index = this.interceptors.request.indexOf(interceptor);
      if (index > -1) this.interceptors.request.splice(index, 1);
    };
  }

  addResponseInterceptor(interceptor: (response: Response) => Response | Promise<Response>) {
    this.interceptors.response.push(interceptor);
    return () => {
      const index = this.interceptors.response.indexOf(interceptor);
      if (index > -1) this.interceptors.response.splice(index, 1);
    };
  }

  private async applyRequestInterceptors(config: RequestConfig): Promise<RequestConfig> {
    let processedConfig = config;
    for (const interceptor of this.interceptors.request) {
      processedConfig = await interceptor(processedConfig);
    }
    return processedConfig;
  }

  private async applyResponseInterceptors(response: Response): Promise<Response> {
    let processedResponse = response;
    for (const interceptor of this.interceptors.response) {
      processedResponse = await interceptor(processedResponse);
    }
    return processedResponse;
  }

  async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
    
    // Apply default config
    const requestConfig: RequestConfig = {
      timeout: this.defaultTimeout,
      retries: this.defaultRetries,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      ...config,
    };

    // Apply request interceptors
    const finalConfig = await this.applyRequestInterceptors(requestConfig);
    
    return this.executeRequest<T>(url, finalConfig);
  }

  private async executeRequest<T>(url: string, config: RequestConfig, retryCount = 0): Promise<T> {
    const { timeout, retries, ...fetchConfig } = config;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchConfig,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Apply response interceptors
      const processedResponse = await this.applyResponseInterceptors(response);

      if (!processedResponse.ok) {
        throw await this.createErrorFromResponse(processedResponse);
      }

      return this.parseResponse<T>(processedResponse);
    } catch (error) {
      if (this.shouldRetry(error, retryCount, retries || 0)) {
        await this.delay(Math.pow(2, retryCount) * 1000);
        return this.executeRequest<T>(url, config, retryCount + 1);
      }
      throw this.normalizeError(error);
    }
  }

  private async createErrorFromResponse(response: Response): Promise<MiniCloudApiError> {
    let message = `HTTP ${response.status}: ${response.statusText}`;
    
    try {
      const errorData = await response.json();
      message = errorData.message || message;
    } catch {
      // Use default message if JSON parsing fails
    }

    return new MiniCloudApiError(message, `HTTP_${response.status}`);
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      return response.json();
    }
    
    if (contentType?.includes('text/')) {
      return response.text() as T;
    }
    
    return response.blob() as T;
  }

  private shouldRetry(error: unknown, retryCount: number, maxRetries: number): boolean {
    if (retryCount >= maxRetries) return false;
    
    if (error instanceof DOMException && error.name === 'AbortError') {
      return true; // Retry timeouts
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return true; // Retry network errors
    }
    
    return false;
  }

  private normalizeError(error: unknown): MiniCloudApiError {
    if (error instanceof MiniCloudApiError) {
      return error;
    }
    
    if (error instanceof DOMException && error.name === 'AbortError') {
      return new MiniCloudApiError('Request timeout', 'TIMEOUT');
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return new MiniCloudApiError('Network error', 'NETWORK_ERROR');
    }
    
    return new MiniCloudApiError(
      error instanceof Error ? error.message : 'Unknown error',
      'UNKNOWN_ERROR'
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Convenience methods
  get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  post<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  put<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  // Modern file upload with fetch and progress
  async uploadFile(
    endpoint: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<Response> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
    const formData = new FormData();
    formData.append('file', file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            onProgress(progress);
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Create a Response-like object for consistency
          const response = new Response(xhr.responseText, {
            status: xhr.status,
            statusText: xhr.statusText,
            headers: new Headers(),
          });
          resolve(response);
        } else {
          reject(new MiniCloudApiError(
            `HTTP ${xhr.status}: ${xhr.statusText}`,
            `HTTP_${xhr.status}`
          ));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new MiniCloudApiError('Network error', 'NETWORK_ERROR'));
      });

      xhr.addEventListener('timeout', () => {
        reject(new MiniCloudApiError('Request timeout', 'TIMEOUT'));
      });

      xhr.open('POST', url);
      xhr.timeout = this.defaultTimeout;
      xhr.send(formData);
    });
  }
}

export const httpClient = new HttpClient();