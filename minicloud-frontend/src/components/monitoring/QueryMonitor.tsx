import React, { useState, useEffect } from 'react';
import { Play, Clock, Database, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { useClusterStatus } from '../../hooks/api';

interface ActiveQuery {
  id: string;
  sql: string;
  startTime: Date;
  progress: number;
  status: 'running' | 'completed' | 'failed';
  workersAssigned: string[];
  resourceUsage: {
    cpu: number;
    memory: number;
    network: number;
  };
  estimatedCompletion?: Date;
  error?: string;
}

interface QueryMonitorProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

// Mock data for demonstration - in a real app this would come from the API
const mockActiveQueries: ActiveQuery[] = [
  {
    id: 'query-001',
    sql: 'SELECT COUNT(*) FROM bank_transactions WHERE amount > 1000',
    startTime: new Date(Date.now() - 30000), // 30 seconds ago
    progress: 75,
    status: 'running',
    workersAssigned: ['worker-1', 'worker-2'],
    resourceUsage: {
      cpu: 0.65,
      memory: 0.45,
      network: 0.30,
    },
    estimatedCompletion: new Date(Date.now() + 10000), // 10 seconds from now
  },
  {
    id: 'query-002',
    sql: 'SELECT AVG(amount), transaction_type FROM bank_transactions GROUP BY transaction_type',
    startTime: new Date(Date.now() - 120000), // 2 minutes ago
    progress: 100,
    status: 'completed',
    workersAssigned: ['worker-1', 'worker-3'],
    resourceUsage: {
      cpu: 0.0,
      memory: 0.0,
      network: 0.0,
    },
  },
  {
    id: 'query-003',
    sql: 'SELECT * FROM non_existent_table',
    startTime: new Date(Date.now() - 60000), // 1 minute ago
    progress: 0,
    status: 'failed',
    workersAssigned: [],
    resourceUsage: {
      cpu: 0.0,
      memory: 0.0,
      network: 0.0,
    },
    error: 'Table "non_existent_table" not found',
  },
];

const getStatusIcon = (status: ActiveQuery['status']) => {
  switch (status) {
    case 'running':
      return <Play className="h-4 w-4 text-blue-600" />;
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-600" />;
    default:
      return <Clock className="h-4 w-4 text-gray-600" />;
  }
};

const getStatusColor = (status: ActiveQuery['status']) => {
  switch (status) {
    case 'running':
      return 'bg-blue-500';
    case 'completed':
      return 'bg-green-500';
    case 'failed':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

const formatDuration = (startTime: Date, endTime?: Date) => {
  const end = endTime || new Date();
  const diff = end.getTime() - startTime.getTime();
  const seconds = Math.floor(diff / 1000);
  
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  } else {
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }
};

const truncateSQL = (sql: string, maxLength: number = 80) => {
  if (sql.length <= maxLength) return sql;
  return sql.substring(0, maxLength) + '...';
};

export const QueryMonitor: React.FC<QueryMonitorProps> = ({
  autoRefresh = true,
  refreshInterval = 5000,
}) => {
  const [activeQueries, setActiveQueries] = useState<ActiveQuery[]>(mockActiveQueries);
  const [showCompleted, setShowCompleted] = useState(true);
  
  const { data: clusterMetrics } = useClusterStatus({
    refetchInterval: autoRefresh ? refreshInterval : undefined,
  });

  // Simulate real-time updates
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setActiveQueries(prev => prev.map(query => {
        if (query.status === 'running' && query.progress < 100) {
          const newProgress = Math.min(100, query.progress + Math.random() * 10);
          return {
            ...query,
            progress: newProgress,
            status: newProgress >= 100 ? 'completed' : 'running',
            resourceUsage: {
              cpu: Math.max(0, query.resourceUsage.cpu + (Math.random() - 0.5) * 0.1),
              memory: Math.max(0, query.resourceUsage.memory + (Math.random() - 0.5) * 0.05),
              network: Math.max(0, query.resourceUsage.network + (Math.random() - 0.5) * 0.1),
            },
          };
        }
        return query;
      }));
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const runningQueries = activeQueries.filter(q => q.status === 'running');
  const completedQueries = activeQueries.filter(q => q.status === 'completed');
  const failedQueries = activeQueries.filter(q => q.status === 'failed');

  const displayQueries = showCompleted 
    ? activeQueries 
    : activeQueries.filter(q => q.status === 'running');

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running Queries</CardTitle>
            <Play className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{runningQueries.length}</div>
            <p className="text-xs text-muted-foreground">
              Currently executing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedQueries.length}</div>
            <p className="text-xs text-muted-foreground">
              Successfully finished
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedQueries.length}</div>
            <p className="text-xs text-muted-foreground">
              Execution errors
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Alerts */}
      {clusterMetrics && clusterMetrics.workers.some(w => w.status !== 'healthy') && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Some workers are unhealthy. This may affect query performance.
            Check the cluster status for more details.
          </AlertDescription>
        </Alert>
      )}

      {/* Query List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Query Execution Monitor
              </CardTitle>
              <CardDescription>
                Real-time monitoring of query execution and resource usage
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCompleted(!showCompleted)}
            >
              {showCompleted ? 'Hide Completed' : 'Show All'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {displayQueries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No active queries</p>
              <p className="text-sm">Query executions will appear here in real-time</p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayQueries.map((query) => (
                <div
                  key={query.id}
                  className="border rounded-lg p-4 space-y-4"
                >
                  {/* Query Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon(query.status)}
                        <span className="font-medium text-sm">{query.id}</span>
                        <Badge
                          variant="secondary"
                          className={`${getStatusColor(query.status)} text-white`}
                        >
                          {query.status}
                        </Badge>
                      </div>
                      <code className="text-sm bg-gray-100 p-2 rounded block">
                        {truncateSQL(query.sql)}
                      </code>
                    </div>
                    <div className="text-right text-sm text-muted-foreground ml-4">
                      <div>Duration: {formatDuration(query.startTime)}</div>
                      {query.estimatedCompletion && query.status === 'running' && (
                        <div>ETA: {formatDuration(new Date(), query.estimatedCompletion)}</div>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {query.status === 'running' && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>{Math.round(query.progress)}%</span>
                      </div>
                      <Progress value={query.progress} className="h-2" />
                    </div>
                  )}

                  {/* Error Message */}
                  {query.error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{query.error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Resource Usage and Workers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="font-medium mb-2">Resource Usage</div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>CPU:</span>
                          <span>{Math.round(query.resourceUsage.cpu * 100)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Memory:</span>
                          <span>{Math.round(query.resourceUsage.memory * 100)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Network:</span>
                          <span>{Math.round(query.resourceUsage.network * 100)}%</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="font-medium mb-2">Assigned Workers</div>
                      <div className="flex flex-wrap gap-1">
                        {query.workersAssigned.length > 0 ? (
                          query.workersAssigned.map((workerId) => (
                            <Badge key={workerId} variant="outline" className="text-xs">
                              {workerId}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-xs">None</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};