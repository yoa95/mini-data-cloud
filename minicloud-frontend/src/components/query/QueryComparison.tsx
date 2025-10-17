import React, { useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { 
  GitCompare, 
  Plus, 
  X, 
  Clock, 
  Database, 
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import SqlEditor from './SqlEditor';
import { useValidateQuery } from '@/hooks/api/queries';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import type { QueryValidationResult } from '@/types/api';

interface QueryComparisonProps {
  initialQueries?: string[];
  className?: string;
  onQuerySelect?: (sql: string) => void;
}

interface ComparisonQuery {
  id: string;
  name: string;
  sql: string;
  validation?: QueryValidationResult;
}

interface ComparisonMetric {
  name: string;
  getValue: (validation?: QueryValidationResult) => number | string;
  format: (value: number | string) => string;
  compare: (a: number | string, b: number | string) => 'better' | 'worse' | 'equal';
  unit?: string;
}

export const QueryComparison: React.FC<QueryComparisonProps> = ({
  initialQueries = [],
  className,
  onQuerySelect,
}) => {
  const [queries, setQueries] = useState<ComparisonQuery[]>(() => 
    initialQueries.map((sql, index) => ({
      id: `query-${index}`,
      name: `Query ${index + 1}`,
      sql,
    }))
  );
  
  const { toast } = useToast();

  // Validation hooks for each query
  const validationResults = queries.map(query => 
    useValidateQuery(query.sql, {
      enabled: !!query.sql.trim(),
    })
  );

  // Update queries with validation results
  React.useEffect(() => {
    setQueries(prev => prev.map((query, index) => ({
      ...query,
      validation: validationResults[index]?.data || undefined,
    })));
  }, [validationResults]);

  // Comparison metrics
  const metrics: ComparisonMetric[] = [
    {
      name: 'Estimated Duration',
      getValue: (validation) => validation?.estimatedCost?.estimatedDuration || 0,
      format: (value) => `${value}ms`,
      compare: (a, b) => {
        const numA = Number(a);
        const numB = Number(b);
        if (numA < numB) return 'better';
        if (numA > numB) return 'worse';
        return 'equal';
      },
    },
    {
      name: 'Data Scanned',
      getValue: (validation) => validation?.estimatedCost?.estimatedBytes || 0,
      format: (value) => `${(Number(value) / 1024 / 1024).toFixed(2)} MB`,
      compare: (a, b) => {
        const numA = Number(a);
        const numB = Number(b);
        if (numA < numB) return 'better';
        if (numA > numB) return 'worse';
        return 'equal';
      },
    },
    {
      name: 'Query Cost',
      getValue: (validation) => validation?.estimatedCost?.estimatedCost || 0,
      format: (value) => `${Number(value).toFixed(2)} units`,
      compare: (a, b) => {
        const numA = Number(a);
        const numB = Number(b);
        if (numA < numB) return 'better';
        if (numA > numB) return 'worse';
        return 'equal';
      },
    },
    {
      name: 'Complexity',
      getValue: (validation) => {
        const complexity = validation?.estimatedCost?.complexity;
        if (complexity === 'low') return 1;
        if (complexity === 'medium') return 2;
        if (complexity === 'high') return 3;
        return 0;
      },
      format: (value) => {
        if (value === 1) return 'Low';
        if (value === 2) return 'Medium';
        if (value === 3) return 'High';
        return 'Unknown';
      },
      compare: (a, b) => {
        const numA = Number(a);
        const numB = Number(b);
        if (numA < numB) return 'better';
        if (numA > numB) return 'worse';
        return 'equal';
      },
    },
    {
      name: 'Errors',
      getValue: (validation) => validation?.errors?.length || 0,
      format: (value) => String(value),
      compare: (a, b) => {
        const numA = Number(a);
        const numB = Number(b);
        if (numA < numB) return 'better';
        if (numA > numB) return 'worse';
        return 'equal';
      },
    },
    {
      name: 'Warnings',
      getValue: (validation) => validation?.warnings?.length || 0,
      format: (value) => String(value),
      compare: (a, b) => {
        const numA = Number(a);
        const numB = Number(b);
        if (numA < numB) return 'better';
        if (numA > numB) return 'worse';
        return 'equal';
      },
    },
  ];

  // Add new query
  const handleAddQuery = useCallback(() => {
    const newQuery: ComparisonQuery = {
      id: `query-${Date.now()}`,
      name: `Query ${queries.length + 1}`,
      sql: '',
    };
    setQueries(prev => [...prev, newQuery]);
  }, [queries.length]);

  // Remove query
  const handleRemoveQuery = useCallback((queryId: string) => {
    if (queries.length <= 1) {
      toast({
        title: 'Cannot Remove',
        description: 'At least one query is required for comparison.',
        variant: 'error',
      });
      return;
    }
    
    setQueries(prev => prev.filter(q => q.id !== queryId));
  }, [queries.length, toast]);

  // Update query
  const handleUpdateQuery = useCallback((queryId: string, updates: Partial<ComparisonQuery>) => {
    setQueries(prev => prev.map(q => 
      q.id === queryId ? { ...q, ...updates } : q
    ));
  }, []);

  // Select query for main editor
  const handleSelectQuery = useCallback((query: ComparisonQuery) => {
    onQuerySelect?.(query.sql);
    toast({
      title: 'Query Selected',
      description: `"${query.name}" has been loaded into the main editor.`,
      variant: 'success',
    });
  }, [onQuerySelect, toast]);

  // Get comparison icon
  const getComparisonIcon = (comparison: 'better' | 'worse' | 'equal') => {
    switch (comparison) {
      case 'better':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'worse':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'equal':
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  // Get best performing query for each metric
  const getBestQuery = (metric: ComparisonMetric) => {
    if (queries.length === 0) return null;
    
    let bestQuery = queries[0];
    let bestValue = metric.getValue(bestQuery.validation);
    
    for (let i = 1; i < queries.length; i++) {
      const currentValue = metric.getValue(queries[i].validation);
      const comparison = metric.compare(currentValue, bestValue);
      if (comparison === 'better') {
        bestQuery = queries[i];
        bestValue = currentValue;
      }
    }
    
    return bestQuery;
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5" />
            <h3 className="font-semibold">Query Comparison</h3>
            <Badge variant="outline">{queries.length} queries</Badge>
          </div>
          
          <Button
            onClick={handleAddQuery}
            size="sm"
            variant="outline"
            disabled={queries.length >= 4}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Query
          </Button>
        </div>
      </div>

      {/* Query Editors */}
      <div className="p-4 border-b border-border">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {queries.map((query, index) => (
            <Card key={query.id} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Input
                  value={query.name}
                  onChange={(e) => handleUpdateQuery(query.id, { name: e.target.value })}
                  className="font-medium bg-transparent border-none p-0 h-auto focus-visible:ring-0"
                />
                
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleSelectQuery(query)}
                    size="sm"
                    variant="outline"
                    disabled={!query.sql.trim()}
                  >
                    Use
                  </Button>
                  
                  <Button
                    onClick={() => handleRemoveQuery(query.id)}
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={queries.length <= 1}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <SqlEditor
                value={query.sql}
                onChange={(sql) => handleUpdateQuery(query.id, { sql })}
                height={200}
                showMinimap={false}
                placeholder={`Enter SQL query ${index + 1}...`}
              />
              
              {/* Query Status */}
              <div className="mt-3 flex items-center gap-2">
                {query.validation?.isValid ? (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Valid
                  </Badge>
                ) : query.validation?.errors && query.validation.errors.length > 0 ? (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {query.validation.errors.length} errors
                  </Badge>
                ) : query.sql.trim() ? (
                  <Badge variant="outline">Validating...</Badge>
                ) : (
                  <Badge variant="secondary">Empty</Badge>
                )}
                
                {query.validation?.warnings && query.validation.warnings.length > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {query.validation.warnings.length} warnings
                  </Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="p-4">
        <h4 className="font-medium mb-4">Performance Comparison</h4>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 font-medium">Metric</th>
                {queries.map((query) => (
                  <th key={query.id} className="text-left p-3 font-medium">
                    {query.name}
                  </th>
                ))}
                <th className="text-left p-3 font-medium">Best</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => {
                const bestQuery = getBestQuery(metric);
                
                return (
                  <tr key={metric.name} className="border-b border-border">
                    <td className="p-3 font-medium">{metric.name}</td>
                    {queries.map((query) => {
                      const value = metric.getValue(query.validation);
                      const formattedValue = metric.format(value);
                      
                      // Compare with first query
                      const baseValue = metric.getValue(queries[0]?.validation);
                      const comparison = queries.indexOf(query) === 0 
                        ? 'equal' 
                        : metric.compare(value, baseValue);
                      
                      const isBest = bestQuery?.id === query.id;
                      
                      return (
                        <td key={query.id} className="p-3">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              isBest && 'font-semibold text-green-600 dark:text-green-400'
                            )}>
                              {formattedValue}
                            </span>
                            {queries.indexOf(query) > 0 && getComparisonIcon(comparison)}
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-3">
                      {bestQuery && (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle className="w-3 h-3" />
                          {bestQuery.name}
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        {queries.length > 1 && (
          <Card className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <h5 className="font-medium text-blue-700 dark:text-blue-300 mb-2">
              Comparison Summary
            </h5>
            <div className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
              {(() => {
                const durationBest = getBestQuery(metrics[0]);
                const costBest = getBestQuery(metrics[2]);
                
                return (
                  <>
                    {durationBest && (
                      <p>• Fastest execution: <strong>{durationBest.name}</strong></p>
                    )}
                    {costBest && (
                      <p>• Lowest cost: <strong>{costBest.name}</strong></p>
                    )}
                    <p>• Consider the trade-offs between performance, cost, and complexity when choosing a query.</p>
                  </>
                );
              })()}
            </div>
          </Card>
        )}
      </div>
    </Card>
  );
};

export default QueryComparison;