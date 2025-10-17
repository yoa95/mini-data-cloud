import { type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { Button } from './Button';
import { Card } from './Card';
import type { ErrorInfo } from 'react-dom/client';

interface FeatureErrorFallbackProps {
  error?: Error;
  onRetry: () => void;
  onGoBack: () => void;
  featureName: string;
}

const FeatureErrorFallback: React.FC<FeatureErrorFallbackProps> = ({
  error,
  onRetry,
  onGoBack,
  featureName
}) => (
  <div className="p-6">
    <Card className="max-w-lg mx-auto text-center p-6">
      <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {featureName} Error
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        There was a problem with the {featureName.toLowerCase()} feature. 
        You can try again or go back to continue using other features.
      </p>
      
      <div className="space-y-3">
        <Button onClick={onRetry} className="w-full">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
        <Button variant="outline" onClick={onGoBack} className="w-full">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
      
      {process.env['NODE_ENV'] === 'development' && error && (
        <details className="mt-4 text-left">
          <summary className="cursor-pointer text-sm text-gray-500">
            Error Details
          </summary>
          <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">
            {error.message}
          </div>
        </details>
      )}
    </Card>
  </div>
);

interface FeatureErrorBoundaryProps {
  children: ReactNode;
  featureName: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export const FeatureErrorBoundary: React.FC<FeatureErrorBoundaryProps> = ({
  children,
  featureName,
  onError
}) => {
  const handleRetry = () => {
    window.location.reload();
  };

  const handleGoBack = () => {
    window.history.back();
  };

  return (
    <ErrorBoundary
      feature={featureName}
      enableAutoRecovery={true}
      maxRetries={2}
      onError={onError}
      fallback={
        <FeatureErrorFallback
          featureName={featureName}
          onRetry={handleRetry}
          onGoBack={handleGoBack}
        />
      }
    >
      {children}
    </ErrorBoundary>
  );
};

// Specific error boundaries for different features
export const QueryErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <FeatureErrorBoundary featureName="Query Interface">
    {children}
  </FeatureErrorBoundary>
);

export const MonitorErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <FeatureErrorBoundary featureName="System Monitor">
    {children}
  </FeatureErrorBoundary>
);

export const MetadataErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <FeatureErrorBoundary featureName="Metadata Explorer">
    {children}
  </FeatureErrorBoundary>
);

export const UploadErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <FeatureErrorBoundary featureName="Data Upload">
    {children}
  </FeatureErrorBoundary>
);

export const ConfigErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <FeatureErrorBoundary featureName="Configuration">
    {children}
  </FeatureErrorBoundary>
);