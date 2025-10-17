import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { 
  QueryErrorBoundary, 
  MonitorErrorBoundary, 
  MetadataErrorBoundary 
} from '@/components/ui/FeatureErrorBoundary';
import { ErrorReportDashboard } from '@/components/ui/ErrorReportDashboard';
import { useErrorRecovery } from '@/hooks/useErrorRecovery';

// Demo components that can throw different types of errors
const NetworkErrorComponent: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Network request failed: Unable to connect to server');
  }
  return <div className="p-4 text-green-600">✅ Network component working fine</div>;
};

const ChunkLoadErrorComponent: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    const error = new Error('Loading chunk 1 failed');
    error.name = 'ChunkLoadError';
    throw error;
  }
  return <div className="p-4 text-green-600">✅ Chunk loading component working fine</div>;
};

const ValidationErrorComponent: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Validation failed: Invalid input data provided');
  }
  return <div className="p-4 text-green-600">✅ Validation component working fine</div>;
};

const RuntimeErrorComponent: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Runtime error: Cannot read property of undefined');
  }
  return <div className="p-4 text-green-600">✅ Runtime component working fine</div>;
};

export const ErrorBoundaryDemo: React.FC = () => {
  const [errors, setErrors] = useState({
    network: false,
    chunk: false,
    validation: false,
    runtime: false
  });
  const [showDashboard, setShowDashboard] = useState(false);
  const { recoveryStats, clearHistory } = useErrorRecovery();

  const toggleError = (type: keyof typeof errors) => {
    setErrors(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const resetAllErrors = () => {
    setErrors({
      network: false,
      chunk: false,
      validation: false,
      runtime: false
    });
  };

  return (
    <div className="p-6 space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Error Boundary Demo</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          This demo shows how different types of errors are handled by our comprehensive error boundary system.
          Each error type has specific recovery strategies and user-friendly messages.
        </p>

        {/* Controls */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button 
            onClick={() => toggleError('network')} 
            variant={errors.network ? 'destructive' : 'outline'}
            size="sm"
          >
            {errors.network ? 'Fix' : 'Trigger'} Network Error
          </Button>
          <Button 
            onClick={() => toggleError('chunk')} 
            variant={errors.chunk ? 'destructive' : 'outline'}
            size="sm"
          >
            {errors.chunk ? 'Fix' : 'Trigger'} Chunk Load Error
          </Button>
          <Button 
            onClick={() => toggleError('validation')} 
            variant={errors.validation ? 'destructive' : 'outline'}
            size="sm"
          >
            {errors.validation ? 'Fix' : 'Trigger'} Validation Error
          </Button>
          <Button 
            onClick={() => toggleError('runtime')} 
            variant={errors.runtime ? 'destructive' : 'outline'}
            size="sm"
          >
            {errors.runtime ? 'Fix' : 'Trigger'} Runtime Error
          </Button>
          <Button onClick={resetAllErrors} variant="secondary" size="sm">
            Reset All
          </Button>
          <Button onClick={() => setShowDashboard(true)} variant="ghost" size="sm">
            View Error Reports
          </Button>
          <Button onClick={clearHistory} variant="ghost" size="sm">
            Clear History
          </Button>
        </div>

        {/* Recovery Stats */}
        {recoveryStats.totalAttempts > 0 && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h3 className="font-semibold mb-2">Recovery Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-medium">Total Attempts</div>
                <div className="text-gray-600 dark:text-gray-400">{recoveryStats.totalAttempts}</div>
              </div>
              <div>
                <div className="font-medium">Success Rate</div>
                <div className="text-gray-600 dark:text-gray-400">
                  {(recoveryStats.successRate * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="font-medium">Avg Duration</div>
                <div className="text-gray-600 dark:text-gray-400">
                  {recoveryStats.averageDuration.toFixed(0)}ms
                </div>
              </div>
              <div>
                <div className="font-medium">Strategies Used</div>
                <div className="text-gray-600 dark:text-gray-400">
                  {recoveryStats.strategiesUsed.length}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Demo Components with Feature-Specific Error Boundaries */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Query Interface</h3>
            <Badge variant="outline">QueryErrorBoundary</Badge>
          </div>
          <QueryErrorBoundary>
            <NetworkErrorComponent shouldThrow={errors.network} />
          </QueryErrorBoundary>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">System Monitor</h3>
            <Badge variant="outline">MonitorErrorBoundary</Badge>
          </div>
          <MonitorErrorBoundary>
            <ChunkLoadErrorComponent shouldThrow={errors.chunk} />
          </MonitorErrorBoundary>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Metadata Explorer</h3>
            <Badge variant="outline">MetadataErrorBoundary</Badge>
          </div>
          <MetadataErrorBoundary>
            <ValidationErrorComponent shouldThrow={errors.validation} />
          </MetadataErrorBoundary>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Runtime Component</h3>
            <Badge variant="outline">Generic ErrorBoundary</Badge>
          </div>
          <QueryErrorBoundary>
            <RuntimeErrorComponent shouldThrow={errors.runtime} />
          </QueryErrorBoundary>
        </Card>
      </div>

      {/* Error Report Dashboard */}
      {showDashboard && (
        <ErrorReportDashboard onClose={() => setShowDashboard(false)} />
      )}

      {/* Information */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Error Boundary Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h4 className="font-medium mb-2">Error Classification</h4>
            <ul className="space-y-1 text-gray-600 dark:text-gray-400">
              <li>• Network errors (connection issues)</li>
              <li>• Chunk load errors (resource loading)</li>
              <li>• Validation errors (data validation)</li>
              <li>• Runtime errors (code execution)</li>
              <li>• Permission errors (access denied)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Recovery Strategies</h4>
            <ul className="space-y-1 text-gray-600 dark:text-gray-400">
              <li>• Automatic retry with exponential backoff</li>
              <li>• Cache clearing and resource reloading</li>
              <li>• Network connectivity checks</li>
              <li>• Authentication token refresh</li>
              <li>• Component state reset</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">User Experience</h4>
            <ul className="space-y-1 text-gray-600 dark:text-gray-400">
              <li>• Context-aware error messages</li>
              <li>• Feature-specific fallback UIs</li>
              <li>• Recovery progress indicators</li>
              <li>• Network status monitoring</li>
              <li>• Detailed error reporting</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Developer Tools</h4>
            <ul className="space-y-1 text-gray-600 dark:text-gray-400">
              <li>• Comprehensive error logging</li>
              <li>• Error report dashboard</li>
              <li>• Recovery statistics tracking</li>
              <li>• Development mode details</li>
              <li>• Component stack traces</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};