import React from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Info, 
  Lightbulb,
  Clock,
  Database,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { 
  QueryValidationResult, 
  DiagnosticError, 
  DiagnosticWarning,
  OptimizationSuggestion,
  QueryCost,
} from '@/types/api';

interface QueryValidationProps {
  validationResult?: QueryValidationResult;
  isValidating?: boolean;
  className?: string;
}

export const QueryValidation: React.FC<QueryValidationProps> = ({
  validationResult,
  isValidating = false,
  className,
}) => {
  if (isValidating) {
    return (
      <Card className={cn('p-4', className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
          Validating query...
        </div>
      </Card>
    );
  }

  if (!validationResult) {
    return null;
  }

  const { isValid, errors, warnings, suggestions, estimatedCost } = validationResult;

  // Get overall status
  const getOverallStatus = () => {
    if (!isValid || errors.length > 0) return 'error';
    if (warnings.length > 0) return 'warning';
    return 'success';
  };

  const status = getOverallStatus();

  // Format cost estimation
  const formatCost = (cost: QueryCost) => {
    const formatDuration = (ms: number) => {
      if (ms < 1000) return `${ms}ms`;
      if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
      return `${(ms / 60000).toFixed(1)}m`;
    };

    const formatBytes = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    };

    return {
      duration: formatDuration(cost.estimatedDuration),
      bytes: formatBytes(cost.estimatedBytes),
      complexity: cost.complexity,
    };
  };

  // Get status icon and color
  const getStatusDisplay = () => {
    switch (status) {
      case 'error':
        return {
          icon: <XCircle className="w-5 h-5" />,
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
          borderColor: 'border-destructive/20',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-5 h-5" />,
          color: 'text-yellow-600 dark:text-yellow-400',
          bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
        };
      case 'success':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-950/20',
          borderColor: 'border-green-200 dark:border-green-800',
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Status Header */}
      <div className={cn('p-4 border-b', statusDisplay.bgColor, statusDisplay.borderColor)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={statusDisplay.color}>
              {statusDisplay.icon}
            </div>
            <div>
              <h3 className={cn('font-medium', statusDisplay.color)}>
                {status === 'error' && 'Query Validation Failed'}
                {status === 'warning' && 'Query Validation Warnings'}
                {status === 'success' && 'Query Validation Passed'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {errors.length > 0 && `${errors.length} error${errors.length !== 1 ? 's' : ''}`}
                {errors.length > 0 && warnings.length > 0 && ', '}
                {warnings.length > 0 && `${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`}
                {errors.length === 0 && warnings.length === 0 && 'No issues found'}
              </p>
            </div>
          </div>

          {isValid && (
            <Badge variant="success">
              Valid SQL
            </Badge>
          )}
        </div>
      </div>

      {/* Cost Estimation */}
      {estimatedCost && (
        <div className="p-4 border-b border-border">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Query Cost Estimation
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Duration:</span>
              <span className="font-medium">{formatCost(estimatedCost).duration}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Database className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Data Scanned:</span>
              <span className="font-medium">{formatCost(estimatedCost).bytes}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Info className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Complexity:</span>
              <Badge 
                variant={
                  estimatedCost.complexity === 'low' ? 'success' :
                  estimatedCost.complexity === 'medium' ? 'default' : 'destructive'
                }
              >
                {estimatedCost.complexity}
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="p-4 border-b border-border">
          <h4 className="font-medium mb-3 flex items-center gap-2 text-destructive">
            <XCircle className="w-4 h-4" />
            Errors ({errors.length})
          </h4>
          
          <div className="space-y-3">
            {errors.map((error: DiagnosticError, index) => (
              <div key={index} className="bg-destructive/5 border border-destructive/20 rounded-md p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive">
                      Line {error.line}, Column {error.column}
                    </p>
                    <p className="text-sm text-destructive/80 mt-1">
                      {error.message}
                    </p>
                    {error.code && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Error Code: {error.code}
                      </p>
                    )}
                  </div>
                  
                  <Badge variant="destructive" className="text-xs">
                    {error.severity}
                  </Badge>
                </div>
                
                {/* Quick Fixes */}
                {error.quickFixes && error.quickFixes.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-destructive/20">
                    <p className="text-xs font-medium text-destructive mb-2">
                      Suggested Fixes:
                    </p>
                    <div className="space-y-1">
                      {error.quickFixes.map((fix, fixIndex) => (
                        <Button
                          key={fixIndex}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                        >
                          {fix.title}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="p-4 border-b border-border">
          <h4 className="font-medium mb-3 flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
            <AlertTriangle className="w-4 h-4" />
            Warnings ({warnings.length})
          </h4>
          
          <div className="space-y-3">
            {warnings.map((warning: DiagnosticWarning, index) => (
              <div key={index} className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                      Line {warning.line}, Column {warning.column}
                    </p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                      {warning.message}
                    </p>
                    {warning.code && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Warning Code: {warning.code}
                      </p>
                    )}
                  </div>
                  
                  <Badge variant="outline" className="text-xs border-yellow-300 text-yellow-700 dark:text-yellow-300">
                    warning
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optimization Suggestions */}
      {suggestions.length > 0 && (
        <div className="p-4">
          <h4 className="font-medium mb-3 flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Lightbulb className="w-4 h-4" />
            Optimization Suggestions ({suggestions.length})
          </h4>
          
          <div className="space-y-3">
            {suggestions.map((suggestion: OptimizationSuggestion, index) => (
              <div key={index} className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      {suggestion.message}
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                      {suggestion.suggestion}
                    </p>
                  </div>
                  
                  <Badge 
                    variant="outline" 
                    className="text-xs border-blue-300 text-blue-700 dark:text-blue-300"
                  >
                    {suggestion.type}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

export default QueryValidation;