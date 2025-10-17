import { type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Settings, Monitor } from 'lucide-react';
import { ErrorBoundary, ErrorReportingService } from './ErrorBoundary';
import { Button } from './Button';
import { Card } from './Card';

interface GlobalErrorFallbackProps {
  error?: Error;
  onRetry: () => void;
  onGoHome: () => void;
  onViewReports: () => void;
}

const GlobalErrorFallback: React.FC<GlobalErrorFallbackProps> = ({
  error,
  onRetry,
  onGoHome,
  onViewReports
}) => (
  <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900">
    <Card className="max-w-2xl w-full text-center p-8">
      <div className="mb-8">
        <AlertTriangle className="h-20 w-20 text-red-500 mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Application Error
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
          The application encountered an unexpected error and needs to restart.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This error has been automatically reported to help us improve the application.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Button onClick={onRetry} size="lg" className="w-full">
          <RefreshCw className="h-5 w-5 mr-2" />
          Restart Application
        </Button>
        
        <Button variant="outline" onClick={onGoHome} size="lg" className="w-full">
          <Home className="h-5 w-5 mr-2" />
          Go to Home
        </Button>
        
        <Button variant="ghost" onClick={onViewReports} size="lg" className="w-full">
          <Settings className="h-5 w-5 mr-2" />
          View Error Reports
        </Button>
        
        <Button 
          variant="ghost" 
          onClick={() => window.open('/monitor', '_blank')} 
          size="lg" 
          className="w-full"
        >
          <Monitor className="h-5 w-5 mr-2" />
          System Status
        </Button>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-semibold mb-4">What happened?</h3>
        <div className="text-left space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <p>
            • The application encountered an error it couldn't recover from automatically
          </p>
          <p>
            • Your data and session information have been preserved where possible
          </p>
          <p>
            • Error details have been logged for investigation
          </p>
          <p>
            • Restarting the application should resolve most issues
          </p>
        </div>
      </div>

      {process.env['NODE_ENV'] === 'development' && error && (
        <details className="mt-6 text-left">
          <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 mb-2">
            Technical Details (Development Mode)
          </summary>
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-mono overflow-auto max-h-60">
            <div className="mb-3">
              <strong>Error:</strong> {error.message}
            </div>
            <div className="mb-3">
              <strong>Stack Trace:</strong>
              <pre className="whitespace-pre-wrap mt-1">{error.stack}</pre>
            </div>
            <div>
              <strong>Timestamp:</strong> {new Date().toISOString()}
            </div>
          </div>
        </details>
      )}
    </Card>
  </div>
);

interface GlobalErrorBoundaryProps {
  children: ReactNode;
}

export const GlobalErrorBoundary: React.FC<GlobalErrorBoundaryProps> = ({ children }) => {
  const errorReporter = ErrorReportingService.getInstance();

  const handleRetry = () => {
    // Clear any cached data that might be causing issues
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    
    // Clear localStorage error reports
    errorReporter.clearReports();
    
    // Reload the application
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const handleViewReports = () => {
    const reports = errorReporter.getReports();
    console.group('📊 Error Reports');
    console.table(reports.map(r => ({
      timestamp: new Date(r.context.timestamp).toLocaleString(),
      type: r.type,
      message: r.error.message,
      feature: r.context.feature || 'Unknown',
      retryCount: r.context.retryCount
    })));
    console.groupEnd();
    
    alert(`Found ${reports.length} error reports. Check the console for details.`);
  };

  const handleGlobalError = (error: Error) => {
    // Additional global error handling
    console.error('Global error boundary caught:', error);
    
    // Try to save current state before crash
    try {
      const currentState = {
        url: window.location.href,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        error: error.message
      };
      localStorage.setItem('crash-state', JSON.stringify(currentState));
    } catch (e) {
      console.warn('Failed to save crash state:', e);
    }
  };

  return (
    <ErrorBoundary
      feature="Application"
      enableAutoRecovery={false} // Don't auto-recover from global errors
      onError={handleGlobalError}
      fallback={
        <GlobalErrorFallback
          onRetry={handleRetry}
          onGoHome={handleGoHome}
          onViewReports={handleViewReports}
        />
      }
    >
      {children}
    </ErrorBoundary>
  );
};