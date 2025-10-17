import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, User, Globe, RefreshCw, Trash2, Download, Filter } from 'lucide-react';
import { ErrorReportingService, type ErrorReport, ErrorType } from './ErrorBoundary';
import { useRecoveryMonitor } from '@/hooks/useErrorRecovery';
import { Button } from './Button';
import { Card } from './Card';
import { Badge } from './Badge';

interface ErrorReportDashboardProps {
  onClose?: () => void;
}

export const ErrorReportDashboard: React.FC<ErrorReportDashboardProps> = ({ onClose }) => {
  const [reports, setReports] = useState<ErrorReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<ErrorReport[]>([]);
  const [selectedType, setSelectedType] = useState<ErrorType | 'ALL'>('ALL');
  const [selectedFeature, setSelectedFeature] = useState<string>('ALL');
  const { isAnyRecovering, recentAttempts } = useRecoveryMonitor();
  const errorReporter = ErrorReportingService.getInstance();

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    filterReports();
  }, [reports, selectedType, selectedFeature]);

  const loadReports = () => {
    const allReports = errorReporter.getReports();
    setReports(allReports);
  };

  const filterReports = () => {
    let filtered = reports;

    if (selectedType !== 'ALL') {
      filtered = filtered.filter(report => report.type === selectedType);
    }

    if (selectedFeature !== 'ALL') {
      filtered = filtered.filter(report => report.context.feature === selectedFeature);
    }

    setFilteredReports(filtered);
  };

  const clearAllReports = () => {
    errorReporter.clearReports();
    setReports([]);
    setFilteredReports([]);
  };

  const exportReports = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      reports: filteredReports.map(report => ({
        type: report.type,
        message: report.error.message,
        stack: report.error.stack,
        feature: report.context.feature,
        url: report.context.url,
        timestamp: new Date(report.context.timestamp).toISOString(),
        retryCount: report.context.retryCount
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-reports-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };



  const uniqueFeatures = ['ALL', ...new Set(reports.map(r => r.context.feature).filter(Boolean))];
  const errorTypes = Object.values(ErrorType);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <h2 className="text-xl font-semibold">Error Report Dashboard</h2>
              {isAnyRecovering && (
                <Badge variant="secondary" className="animate-pulse">
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Recovering
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={loadReports}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={exportReports}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={clearAllReports}>
                <Trash2 className="h-4 w-4 mr-1" />
                Clear All
              </Button>
              {onClose && (
                <Button variant="ghost" size="sm" onClick={onClose}>
                  ×
                </Button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-4 mt-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as ErrorType | 'ALL')}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800"
              >
                <option value="ALL">All Types</option>
                {errorTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <select
                value={selectedFeature}
                onChange={(e) => setSelectedFeature(e.target.value)}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800"
              >
                {uniqueFeatures.map(feature => (
                  <option key={feature} value={feature}>
                    {feature === 'ALL' ? 'All Features' : feature || 'Unknown Feature'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {filteredReports.length}
              </div>
              <div className="text-sm text-gray-500">Total Errors</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {filteredReports.filter(r => r.type === ErrorType.RUNTIME).length}
              </div>
              <div className="text-sm text-gray-500">Runtime Errors</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {filteredReports.filter(r => r.type === ErrorType.NETWORK).length}
              </div>
              <div className="text-sm text-gray-500">Network Errors</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {recentAttempts.filter(a => a.success).length}
              </div>
              <div className="text-sm text-gray-500">Recovered</div>
            </div>
          </div>
        </div>

        <div className="overflow-auto max-h-[60vh]">
          {filteredReports.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No error reports found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredReports.map((report, index) => (
                <ErrorReportItem key={index} report={report} />
              ))}
            </div>
          )}
        </div>

        {/* Recent Recovery Attempts */}
        {recentAttempts.length > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold mb-2">Recent Recovery Attempts</h3>
            <div className="space-y-1">
              {recentAttempts.slice(0, 3).map((attempt, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="flex items-center space-x-2">
                    <Badge 
                      variant={attempt.success ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {attempt.strategy}
                    </Badge>
                    <span className="text-gray-500">
                      {new Date(attempt.timestamp).toLocaleTimeString()}
                    </span>
                  </span>
                  <span className={attempt.success ? 'text-green-600' : 'text-red-600'}>
                    {attempt.success ? '✓' : '✗'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

interface ErrorReportItemProps {
  report: ErrorReport;
}

const ErrorReportItem: React.FC<ErrorReportItemProps> = ({ report }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3 mb-2">
            <Badge className={`text-xs ${getErrorTypeColor(report.type)}`}>
              {report.type}
            </Badge>
            {report.context.feature && (
              <Badge variant="outline" className="text-xs">
                {report.context.feature}
              </Badge>
            )}
            <div className="flex items-center text-xs text-gray-500 space-x-1">
              <Clock className="h-3 w-3" />
              <span>{new Date(report.context.timestamp).toLocaleString()}</span>
            </div>
          </div>
          
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
            {report.error.message}
          </div>
          
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            <div className="flex items-center space-x-1">
              <Globe className="h-3 w-3" />
              <span className="truncate max-w-xs">{report.context.url}</span>
            </div>
            <div className="flex items-center space-x-1">
              <User className="h-3 w-3" />
              <span>Retry: {report.context.retryCount}</span>
            </div>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="ml-4"
        >
          {expanded ? '−' : '+'}
        </Button>
      </div>
      
      {expanded && (
        <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
          <div className="text-xs font-mono space-y-2">
            <div>
              <strong>Stack Trace:</strong>
              <pre className="whitespace-pre-wrap mt-1 text-xs overflow-auto max-h-40">
                {report.error.stack}
              </pre>
            </div>
            {report.errorInfo.componentStack && (
              <div>
                <strong>Component Stack:</strong>
                <pre className="whitespace-pre-wrap mt-1 text-xs overflow-auto max-h-40">
                  {report.errorInfo.componentStack}
                </pre>
              </div>
            )}
            <div>
              <strong>User Agent:</strong> {report.context.userAgent}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function getErrorTypeColor(type: ErrorType): string {
  switch (type) {
    case ErrorType.NETWORK:
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case ErrorType.CHUNK_LOAD:
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case ErrorType.PERMISSION:
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case ErrorType.VALIDATION:
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case ErrorType.RUNTIME:
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
}