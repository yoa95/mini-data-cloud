import React, { useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { 
  Zap, 
  Clock, 
  Database, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Info,
  BarChart3,
  Activity,
  Target,
} from 'lucide-react';
import { useValidateQuery, useCheckQuerySupport } from '@/hooks/api/queries';
import { cn } from '@/lib/utils';
import type { QueryValidationResult, QueryCost, OptimizationSuggestion } from '@/types/api';

interface QueryPerformanceAnalyzerProps {
  sql: string;
  className?: string;
  onOptimizationApplied?: (optimizedSql: string) => void;
}

interface PerformanceMetric {
  name: string;
  value: string | number;
  unit?: string;
  status: 'good' | 'warning' | 'error';
  description: string;
}

interface ExplainPlanNode {
  id: string;
  operation: string;
  table?: string;
  cost: number;
  rows: number;
  children: ExplainPlanNode[];
  details: Record<string, any>;
}

export const QueryPerformanceAnalyzer: React.FC<QueryPerformanceAnalyzerProps> = ({
  sql,
  className,
  onOptimizationApplied,
}) => {
  const [activeTab, setActiveTab] = useState<'cost' | 'explain' | 'optimize'>('cost');
  
  // Get validation and cost estimation
  const { data: validationResult } = useValidateQuery(sql, {
    enabled: !!sql.trim(),
  });
  
  // Check query support
  const { data: supportResult } = useCheckQuerySupport(sql, {
    enabled: !!sql.trim(),
  });

  // Mock explain plan data (in real implementation, this would come from the API)
  const mockExplainPlan: ExplainPlanNode = {
    id: 'root',
    operation: 'SELECT',
    cost: 1250,
    rows: 10000,
    children: [
      {
        id: 'scan',
        operation: 'TABLE_SCAN',
        table: 'bank_transactions',
        cost: 1000,
        rows: 50000,
        children: [],
        details: {
          filter: 'amount > 100',
          selectivity: 0.2,
        },
      },
      {
        id: 'sort',
        operation: 'SORT',
        cost: 250,
        rows: 10000,
        children: [],
        details: {
          sortKeys: ['amount DESC'],
          algorithm: 'quicksort',
        },
      },
    ],
    details: {
      limit: 100,
    },
  };

  // Generate performance metrics
  const generateMetrics = useCallback((): PerformanceMetric[] => {
    const cost = validationResult?.estimatedCost;
    if (!cost) return [];

    const metrics: PerformanceMetric[] = [
      {
        name: 'Estimated Duration',
        value: cost.estimatedDuration,
        unit: 'ms',
        status: cost.estimatedDuration < 1000 ? 'good' : cost.estimatedDuration < 5000 ? 'warning' : 'error',
        description: 'Expected query execution time',
      },
      {
        name: 'Data Scanned',
        value: (cost.estimatedBytes / 1024 / 1024).toFixed(2),
        unit: 'MB',
        status: cost.estimatedBytes < 100 * 1024 * 1024 ? 'good' : cost.estimatedBytes < 1024 * 1024 * 1024 ? 'warning' : 'error',
        description: 'Amount of data that will be processed',
      },
      {
        name: 'Query Complexity',
        value: cost.complexity.toUpperCase(),
        status: cost.complexity === 'low' ? 'good' : cost.complexity === 'medium' ? 'warning' : 'error',
        description: 'Overall complexity assessment',
      },
      {
        name: 'Estimated Cost',
        value: cost.estimatedCost.toFixed(2),
        unit: 'units',
        status: cost.estimatedCost < 100 ? 'good' : cost.estimatedCost < 1000 ? 'warning' : 'error',
        description: 'Relative cost compared to other queries',
      },
    ];

    return metrics;
  }, [validationResult]);

  // Apply optimization suggestion
  const handleApplyOptimization = useCallback((suggestion: OptimizationSuggestion) => {
    // In a real implementation, this would apply the suggested optimization
    // For now, we'll just show the suggestion
    onOptimizationApplied?.(sql + '\n-- Applied optimization: ' + suggestion.suggestion);
  }, [sql, onOptimizationApplied]);

  // Get status icon and color
  const getStatusDisplay = (status: 'good' | 'warning' | 'error') => {
    switch (status) {
      case 'good':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          color: 'text-green-600 dark:text-green-400',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-4 h-4" />,
          color: 'text-yellow-600 dark:text-yellow-400',
        };
      case 'error':
        return {
          icon: <AlertTriangle className="w-4 h-4" />,
          color: 'text-red-600 dark:text-red-400',
        };
    }
  };

  // Render explain plan node
  const renderExplainNode = (node: ExplainPlanNode, depth = 0) => {
    const indent = depth * 20;
    
    return (
      <div key={node.id} className="space-y-2">
        <div 
          className="flex items-center gap-3 p-3 border border-border rounded-md"
          style={{ marginLeft: indent }}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline">{node.operation}</Badge>
              {node.table && (
                <Badge variant="secondary">{node.table}</Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              Cost: {node.cost.toLocaleString()} • Rows: {node.rows.toLocaleString()}
            </div>
            {Object.keys(node.details).length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                {Object.entries(node.details).map(([key, value]) => (
                  <span key={key} className="mr-3">
                    {key}: {String(value)}
                  </span>
                ))}
              </div>
            )}
          </div>
          
          <div className="text-right">
            <div className="text-sm font-medium">{((node.cost / mockExplainPlan.cost) * 100).toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">of total</div>
          </div>
        </div>
        
        {node.children.map(child => renderExplainNode(child, depth + 1))}
      </div>
    );
  };

  const metrics = generateMetrics();

  if (!sql.trim()) {
    return (
      <Card className={cn('p-8 text-center', className)}>
        <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">
          Enter a SQL query to analyze performance
        </p>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            <h3 className="font-semibold">Performance Analysis</h3>
          </div>
          
          {supportResult && (
            <Badge variant={supportResult.supported ? 'success' : 'destructive'}>
              {supportResult.supported ? 'Supported' : 'Not Supported'}
            </Badge>
          )}
        </div>
        
        {supportResult && !supportResult.supported && (
          <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{supportResult.reason}</p>
          </div>
        )}
      </div>

      {/* Analysis Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <div className="px-4 pt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="cost" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              Cost Analysis
            </TabsTrigger>
            <TabsTrigger value="explain" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Execution Plan
            </TabsTrigger>
            <TabsTrigger value="optimize" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Optimization
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="cost" className="mt-0 p-4">
          {metrics.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {metrics.map((metric, index) => {
                  const statusDisplay = getStatusDisplay(metric.status);
                  return (
                    <Card key={index} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{metric.name}</h4>
                        <div className={statusDisplay.color}>
                          {statusDisplay.icon}
                        </div>
                      </div>
                      <div className="text-2xl font-bold mb-1">
                        {metric.value}
                        {metric.unit && <span className="text-sm font-normal text-muted-foreground ml-1">{metric.unit}</span>}
                      </div>
                      <p className="text-sm text-muted-foreground">{metric.description}</p>
                    </Card>
                  );
                })}
              </div>

              {/* Cost Breakdown */}
              <Card className="p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Cost Breakdown
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Data Scanning</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-muted rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: '60%' }} />
                      </div>
                      <span className="text-sm font-medium">60%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Processing</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-muted rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: '25%' }} />
                      </div>
                      <span className="text-sm font-medium">25%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Network I/O</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-muted rounded-full h-2">
                        <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '15%' }} />
                      </div>
                      <span className="text-sm font-medium">15%</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Cost analysis not available for this query
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="explain" className="mt-0 p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Query Execution Plan</h4>
              <Badge variant="outline">
                Total Cost: {mockExplainPlan.cost.toLocaleString()}
              </Badge>
            </div>
            
            <div className="space-y-2">
              {renderExplainNode(mockExplainPlan)}
            </div>

            <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Execution Plan Analysis
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                    The table scan operation accounts for 80% of the total cost. Consider adding an index on the 'amount' column to improve performance.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="optimize" className="mt-0 p-4">
          {validationResult?.suggestions && validationResult.suggestions.length > 0 ? (
            <div className="space-y-4">
              <h4 className="font-medium">Optimization Suggestions</h4>
              
              {validationResult.suggestions.map((suggestion, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{suggestion.type}</Badge>
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      </div>
                      <h5 className="font-medium mb-1">{suggestion.message}</h5>
                      <p className="text-sm text-muted-foreground mb-3">
                        {suggestion.suggestion}
                      </p>
                    </div>
                    
                    <Button
                      onClick={() => handleApplyOptimization(suggestion)}
                      size="sm"
                      variant="outline"
                    >
                      Apply
                    </Button>
                  </div>
                </Card>
              ))}

              {/* Additional optimization tips */}
              <Card className="p-4">
                <h5 className="font-medium mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  General Optimization Tips
                </h5>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Use LIMIT clauses to reduce the amount of data returned</li>
                  <li>• Add WHERE clauses to filter data early in the query</li>
                  <li>• Consider using column-specific queries instead of SELECT *</li>
                  <li>• Use appropriate data types for better performance</li>
                  <li>• Consider partitioning large tables by frequently queried columns</li>
                </ul>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No optimization suggestions available for this query
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default QueryPerformanceAnalyzer;