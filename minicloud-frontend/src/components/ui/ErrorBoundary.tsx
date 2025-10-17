import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, Wifi, WifiOff } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';

// Error types for better categorization
export const ErrorType = {
  NETWORK: 'NETWORK',
  CHUNK_LOAD: 'CHUNK_LOAD',
  PERMISSION: 'PERMISSION',
  VALIDATION: 'VALIDATION',
  RUNTIME: 'RUNTIME',
  UNKNOWN: 'UNKNOWN'
} as const;

export type ErrorType = typeof ErrorType[keyof typeof ErrorType];

export interface ErrorContext {
  feature?: string;
  userId?: string;
  timestamp: number;
  userAgent: string;
  url: string;
  retryCount: number;
}

export interface ErrorReport {
  error: Error;
  errorInfo: ErrorInfo;
  context: ErrorContext;
  type: ErrorType;
}

// Error reporting service
class ErrorReportingService {
  private static instance: ErrorReportingService;
  private reports: ErrorReport[] = [];
  private maxReports = 100;

  static getInstance(): ErrorReportingService {
    if (!ErrorReportingService.instance) {
      ErrorReportingService.instance = new ErrorReportingService();
    }
    return ErrorReportingService.instance;
  }

  reportError(report: ErrorReport): void {
    // Add to local storage for debugging
    this.reports.unshift(report);
    if (this.reports.length > this.maxReports) {
      this.reports = this.reports.slice(0, this.maxReports);
    }

    // Log to console in development
    if (process.env['NODE_ENV'] === 'development') {
      console.group('🚨 Error Report');
      console.error('Error:', report.error);
      console.error('Error Info:', report.errorInfo);
      console.error('Context:', report.context);
      console.error('Type:', report.type);
      console.groupEnd();
    }

    // In production, send to error tracking service
    if (process.env['NODE_ENV'] === 'production') {
      this.sendToErrorService(report);
    }

    // Store in localStorage for persistence
    try {
      localStorage.setItem('error-reports', JSON.stringify(this.reports.slice(0, 10)));
    } catch (e) {
      console.warn('Failed to store error reports in localStorage:', e);
    }
  }

  private async sendToErrorService(report: ErrorReport): Promise<void> {
    try {
      // This would integrate with services like Sentry, LogRocket, etc.
      // For now, we'll just simulate the API call
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: report.error.message,
          stack: report.error.stack,
          componentStack: report.errorInfo.componentStack,
          context: report.context,
          type: report.type,
        }),
      });
    } catch (e) {
      console.warn('Failed to send error report:', e);
    }
  }

  getReports(): ErrorReport[] {
    return [...this.reports];
  }

  clearReports(): void {
    this.reports = [];
    localStorage.removeItem('error-reports');
  }
}

// Utility to classify errors
function classifyError(error: Error): ErrorType {
  const message = error.message.toLowerCase();
  const stack = error.stack?.toLowerCase() || '';

  if (message.includes('network') || message.includes('fetch')) {
    return ErrorType.NETWORK;
  }
  if (message.includes('loading chunk') || message.includes('loading css chunk')) {
    return ErrorType.CHUNK_LOAD;
  }
  if (message.includes('permission') || message.includes('unauthorized')) {
    return ErrorType.PERMISSION;
  }
  if (message.includes('validation') || stack.includes('validation')) {
    return ErrorType.VALIDATION;
  }
  if (error.name === 'ChunkLoadError') {
    return ErrorType.CHUNK_LOAD;
  }

  return ErrorType.RUNTIME;
}

// Recovery strategies
interface RecoveryStrategy {
  canRecover: (error: Error, errorType: ErrorType) => boolean;
  recover: () => Promise<boolean>;
  description: string;
}

const recoveryStrategies: RecoveryStrategy[] = [
  {
    canRecover: (_error, type) => type === ErrorType.CHUNK_LOAD,
    recover: async () => {
      // Reload the page for chunk load errors
      window.location.reload();
      return true;
    },
    description: 'Reloading application to fetch missing resources...'
  },
  {
    canRecover: (_error, type) => type === ErrorType.NETWORK,
    recover: async () => {
      // Wait and retry for network errors
      await new Promise(resolve => setTimeout(resolve, 2000));
      return navigator.onLine;
    },
    description: 'Checking network connection...'
  }
];

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  feature?: string;
  enableAutoRecovery?: boolean;
  maxRetries?: number;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorType: ErrorType;
  retryCount: number;
  isRecovering: boolean;
  recoveryMessage?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  private errorReporter = ErrorReportingService.getInstance();
  private retryTimeout?: NodeJS.Timeout;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      errorType: ErrorType.UNKNOWN,
      retryCount: 0,
      isRecovering: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { 
      hasError: true, 
      error,
      errorType: classifyError(error)
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const errorType = classifyError(error);
    const context: ErrorContext = {
      ...(this.props.feature && { feature: this.props.feature }),
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      retryCount: this.state.retryCount
    };

    // Report the error
    this.errorReporter.reportError({
      error,
      errorInfo,
      context,
      type: errorType
    });

    this.setState({
      error,
      errorInfo,
      errorType
    });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Attempt auto-recovery if enabled
    if (this.props.enableAutoRecovery && this.state.retryCount < (this.props.maxRetries || 3)) {
      this.attemptAutoRecovery(error, errorType);
    }
  }

  private attemptAutoRecovery = async (error: Error, errorType: ErrorType): Promise<void> => {
    const strategy = recoveryStrategies.find(s => s.canRecover(error, errorType));
    
    if (!strategy) return;

    this.setState({ 
      isRecovering: true, 
      recoveryMessage: strategy.description 
    });

    try {
      const recovered = await strategy.recover();
      if (recovered) {
        this.handleRetry();
      } else {
        this.setState({ isRecovering: false });
      }
    } catch (recoveryError) {
      console.warn('Auto-recovery failed:', recoveryError);
      this.setState({ isRecovering: false });
    }
  };

  handleRetry = (): void => {
    this.setState(prevState => ({ 
      hasError: false, 
      errorType: ErrorType.UNKNOWN,
      retryCount: prevState.retryCount + 1,
      isRecovering: false
    }));
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  handleReportBug = (): void => {
    const report = {
      error: this.state.error?.message,
      stack: this.state.error?.stack,
      feature: this.props.feature,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
    
    // In a real app, this would open a bug report form
    console.log('Bug report:', report);
    
    // Copy to clipboard for easy reporting
    navigator.clipboard?.writeText(JSON.stringify(report, null, 2));
    alert('Error details copied to clipboard. Please paste in your bug report.');
  };

  getErrorMessage = (): { title: string; message: string; icon: React.ReactNode } => {
    const { errorType, error } = this.state;
    
    switch (errorType) {
      case ErrorType.NETWORK:
        return {
          title: 'Connection Problem',
          message: 'Unable to connect to the server. Please check your internet connection.',
          icon: <WifiOff className="h-16 w-16 text-orange-500 mx-auto mb-4" />
        };
      case ErrorType.CHUNK_LOAD:
        return {
          title: 'Loading Error',
          message: 'Failed to load application resources. This usually resolves with a page refresh.',
          icon: <RefreshCw className="h-16 w-16 text-blue-500 mx-auto mb-4" />
        };
      case ErrorType.PERMISSION:
        return {
          title: 'Access Denied',
          message: 'You don\'t have permission to access this resource.',
          icon: <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        };
      case ErrorType.VALIDATION:
        return {
          title: 'Invalid Data',
          message: 'The data provided is invalid. Please check your input and try again.',
          icon: <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
        };
      default:
        return {
          title: 'Something went wrong',
          message: error?.message || 'An unexpected error occurred. Please try again.',
          icon: <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        };
    }
  };

  override componentWillUnmount(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Show recovery message if recovering
      if (this.state.isRecovering) {
        return (
          <div className="min-h-[400px] flex items-center justify-center p-8">
            <Card className="max-w-md text-center p-8">
              <RefreshCw className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-semibold mb-2">Recovering...</h3>
              <p className="text-gray-600 dark:text-gray-400">
                {this.state.recoveryMessage}
              </p>
            </Card>
          </div>
        );
      }

      const errorDisplay = this.getErrorMessage();

      // Default error UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <Card className="max-w-md text-center p-8">
            <div className="mb-6">
              {errorDisplay.icon}
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {errorDisplay.title}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {errorDisplay.message}
              </p>
              
              {this.state.retryCount > 0 && (
                <p className="text-sm text-gray-500 mb-4">
                  Retry attempt: {this.state.retryCount}
                </p>
              )}
            </div>

            <div className="space-y-3 mb-6">
              <Button onClick={this.handleRetry} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              
              <Button variant="outline" onClick={this.handleGoHome} className="w-full">
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
              
              <Button variant="ghost" onClick={this.handleReportBug} className="w-full">
                <Bug className="h-4 w-4 mr-2" />
                Report Issue
              </Button>
            </div>

            {/* Network status indicator */}
            <div className="flex items-center justify-center mb-4 text-sm">
              {navigator.onLine ? (
                <div className="flex items-center text-green-600">
                  <Wifi className="h-4 w-4 mr-1" />
                  Online
                </div>
              ) : (
                <div className="flex items-center text-red-600">
                  <WifiOff className="h-4 w-4 mr-1" />
                  Offline
                </div>
              )}
            </div>

            {process.env['NODE_ENV'] === 'development' && this.state.error && (
              <details className="text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 mb-2">
                  Error Details (Development)
                </summary>
                <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-mono overflow-auto max-h-40">
                  <div className="mb-2">
                    <strong>Type:</strong> {this.state.errorType}
                  </div>
                  <div className="mb-2">
                    <strong>Error:</strong> {this.state.error.message}
                  </div>
                  <div className="mb-2">
                    <strong>Stack:</strong>
                    <pre className="whitespace-pre-wrap">{this.state.error.stack}</pre>
                  </div>
                  {this.state.errorInfo && (
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export const useErrorHandler = () => {
  const errorReporter = ErrorReportingService.getInstance();
  
  return (error: Error, errorInfo?: ErrorInfo) => {
    const errorType = classifyError(error);
    const context: ErrorContext = {
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      retryCount: 0
    };

    errorReporter.reportError({
      error,
      errorInfo: errorInfo || { componentStack: '' },
      context,
      type: errorType
    });
  };
};

// Export the error reporting service for use in other components
export { ErrorReportingService };