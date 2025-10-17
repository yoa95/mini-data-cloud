import { ErrorType } from '@/components/ui/ErrorBoundary';

export interface RecoveryAttempt {
  timestamp: number;
  errorType: ErrorType;
  strategy: string;
  success: boolean;
  duration: number;
}

export interface RecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
  onRecoveryAttempt?: (attempt: RecoveryAttempt) => void;
}

class ErrorRecoveryService {
  private static instance: ErrorRecoveryService;
  private recoveryHistory: RecoveryAttempt[] = [];
  private activeRecoveries = new Map<string, Promise<boolean>>();

  static getInstance(): ErrorRecoveryService {
    if (!ErrorRecoveryService.instance) {
      ErrorRecoveryService.instance = new ErrorRecoveryService();
    }
    return ErrorRecoveryService.instance;
  }

  async attemptRecovery(
    error: Error,
    errorType: ErrorType,
    options: RecoveryOptions = {}
  ): Promise<boolean> {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      exponentialBackoff = true,
      onRecoveryAttempt
    } = options;

    const recoveryKey = `${errorType}-${error.message}`;
    
    // Prevent duplicate recovery attempts
    if (this.activeRecoveries.has(recoveryKey)) {
      return this.activeRecoveries.get(recoveryKey)!;
    }

    const recoveryPromise = this.executeRecovery(
      error,
      errorType,
      maxRetries,
      retryDelay,
      exponentialBackoff,
      onRecoveryAttempt
    );

    this.activeRecoveries.set(recoveryKey, recoveryPromise);
    
    try {
      const result = await recoveryPromise;
      return result;
    } finally {
      this.activeRecoveries.delete(recoveryKey);
    }
  }

  private async executeRecovery(
    error: Error,
    errorType: ErrorType,
    maxRetries: number,
    baseDelay: number,
    exponentialBackoff: boolean,
    onRecoveryAttempt?: (attempt: RecoveryAttempt) => void
  ): Promise<boolean> {
    const strategies = this.getRecoveryStrategies(errorType);
    
    for (const strategy of strategies) {
      let retryCount = 0;
      
      while (retryCount < maxRetries) {
        const startTime = Date.now();
        
        try {
          const success = await strategy.execute(error);
          const duration = Date.now() - startTime;
          
          const attempt: RecoveryAttempt = {
            timestamp: startTime,
            errorType,
            strategy: strategy.name,
            success,
            duration
          };
          
          this.recoveryHistory.push(attempt);
          onRecoveryAttempt?.(attempt);
          
          if (success) {
            console.log(`✅ Recovery successful using strategy: ${strategy.name}`);
            return true;
          }
        } catch (recoveryError) {
          console.warn(`❌ Recovery strategy ${strategy.name} failed:`, recoveryError);
        }
        
        retryCount++;
        
        if (retryCount < maxRetries) {
          const delay = exponentialBackoff 
            ? baseDelay * Math.pow(2, retryCount - 1)
            : baseDelay;
          
          console.log(`⏳ Retrying recovery in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
          await this.delay(delay);
        }
      }
    }
    
    console.log(`❌ All recovery strategies failed for error type: ${errorType}`);
    return false;
  }

  private getRecoveryStrategies(errorType: ErrorType): RecoveryStrategy[] {
    switch (errorType) {
      case ErrorType.NETWORK:
        return [
          new NetworkRecoveryStrategy(),
          new CacheRecoveryStrategy(),
          new OfflineModeStrategy()
        ];
      
      case ErrorType.CHUNK_LOAD:
        return [
          new ChunkReloadStrategy(),
          new CacheClearStrategy(),
          new PageReloadStrategy()
        ];
      
      case ErrorType.PERMISSION:
        return [
          new AuthRefreshStrategy(),
          new LoginRedirectStrategy()
        ];
      
      case ErrorType.VALIDATION:
        return [
          new DataValidationStrategy(),
          new FormResetStrategy()
        ];
      
      default:
        return [
          new GenericRetryStrategy(),
          new ComponentResetStrategy()
        ];
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getRecoveryHistory(): RecoveryAttempt[] {
    return [...this.recoveryHistory];
  }

  clearHistory(): void {
    this.recoveryHistory = [];
  }

  getRecoveryStats(): {
    totalAttempts: number;
    successRate: number;
    averageDuration: number;
    strategiesUsed: string[];
  } {
    const total = this.recoveryHistory.length;
    const successful = this.recoveryHistory.filter(a => a.success).length;
    const avgDuration = total > 0 
      ? this.recoveryHistory.reduce((sum, a) => sum + a.duration, 0) / total 
      : 0;
    const strategies = [...new Set(this.recoveryHistory.map(a => a.strategy))];

    return {
      totalAttempts: total,
      successRate: total > 0 ? successful / total : 0,
      averageDuration: avgDuration,
      strategiesUsed: strategies
    };
  }
}

// Recovery strategy interface
abstract class RecoveryStrategy {
  abstract name: string;
  abstract execute(error: Error): Promise<boolean>;
}

// Network-related recovery strategies
class NetworkRecoveryStrategy extends RecoveryStrategy {
  name = 'Network Connectivity Check';

  async execute(): Promise<boolean> {
    // Check if network is available
    if (!navigator.onLine) {
      return false;
    }

    // Try a simple network request
    try {
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache'
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

class CacheRecoveryStrategy extends RecoveryStrategy {
  name = 'Cache Recovery';

  async execute(): Promise<boolean> {
    try {
      // Try to serve from cache if available
      if ('caches' in window) {
        const cache = await caches.open('api-cache');
        const cachedResponse = await cache.match('/api/health');
        return !!cachedResponse;
      }
      return false;
    } catch {
      return false;
    }
  }
}

class OfflineModeStrategy extends RecoveryStrategy {
  name = 'Offline Mode';

  async execute(): Promise<boolean> {
    // Enable offline mode functionality
    try {
      localStorage.setItem('offline-mode', 'true');
      // Dispatch custom event to notify components
      window.dispatchEvent(new CustomEvent('offline-mode-enabled'));
      return true;
    } catch {
      return false;
    }
  }
}

// Chunk loading recovery strategies
class ChunkReloadStrategy extends RecoveryStrategy {
  name = 'Chunk Reload';

  async execute(): Promise<boolean> {
    try {
      // Force reload of failed chunks
      const scripts = document.querySelectorAll('script[src*="chunk"]');
      for (const script of scripts) {
        const newScript = document.createElement('script');
        newScript.src = script.getAttribute('src') + '?t=' + Date.now();
        document.head.appendChild(newScript);
      }
      return true;
    } catch {
      return false;
    }
  }
}

class CacheClearStrategy extends RecoveryStrategy {
  name = 'Cache Clear';

  async execute(): Promise<boolean> {
    try {
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // Clear localStorage and sessionStorage
      localStorage.clear();
      sessionStorage.clear();
      
      return true;
    } catch {
      return false;
    }
  }
}

class PageReloadStrategy extends RecoveryStrategy {
  name = 'Page Reload';

  async execute(): Promise<boolean> {
    // Last resort - reload the page
    window.location.reload();
    return true; // This will never return, but satisfies the interface
  }
}

// Authentication recovery strategies
class AuthRefreshStrategy extends RecoveryStrategy {
  name = 'Auth Token Refresh';

  async execute(): Promise<boolean> {
    try {
      // Try to refresh authentication token
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          localStorage.setItem('auth-token', data.token);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }
}

class LoginRedirectStrategy extends RecoveryStrategy {
  name = 'Login Redirect';

  async execute(): Promise<boolean> {
    // Redirect to login page
    window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
    return true;
  }
}

// Validation recovery strategies
class DataValidationStrategy extends RecoveryStrategy {
  name = 'Data Validation Reset';

  async execute(): Promise<boolean> {
    try {
      // Clear potentially corrupted form data
      const forms = document.querySelectorAll('form');
      forms.forEach(form => form.reset());
      
      // Clear validation errors
      const errorElements = document.querySelectorAll('[data-error]');
      errorElements.forEach(el => el.removeAttribute('data-error'));
      
      return true;
    } catch {
      return false;
    }
  }
}

class FormResetStrategy extends RecoveryStrategy {
  name = 'Form Reset';

  async execute(): Promise<boolean> {
    try {
      // Reset all forms and clear local storage form data
      const forms = document.querySelectorAll('form');
      forms.forEach(form => form.reset());
      
      // Clear form-related localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('form-') || key.startsWith('input-')) {
          localStorage.removeItem(key);
        }
      });
      
      return true;
    } catch {
      return false;
    }
  }
}

// Generic recovery strategies
class GenericRetryStrategy extends RecoveryStrategy {
  name = 'Generic Retry';

  async execute(): Promise<boolean> {
    // Wait a bit and return true to trigger a retry
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
  }
}

class ComponentResetStrategy extends RecoveryStrategy {
  name = 'Component Reset';

  async execute(): Promise<boolean> {
    try {
      // Dispatch a custom event to reset components
      window.dispatchEvent(new CustomEvent('component-reset'));
      return true;
    } catch {
      return false;
    }
  }
}

export default ErrorRecoveryService;