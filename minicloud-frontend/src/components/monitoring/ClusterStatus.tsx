import React from 'react';
import { RefreshCw, Server, Activity, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { useClusterStatus } from '../../hooks/api';
import type { WorkerStatus } from '../../types/api';

interface ClusterStatusProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const getStatusColor = (status: WorkerStatus['status']) => {
  switch (status) {
    case 'healthy':
      return 'bg-green-500';
    case 'unhealthy':
      return 'bg-yellow-500';
    case 'offline':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

const getStatusIcon = (status: WorkerStatus['status']) => {
  switch (status) {
    case 'healthy':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'unhealthy':
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    case 'offline':
      return <XCircle className="h-4 w-4 text-red-600" />;
    default:
      return <Server className="h-4 w-4 text-gray-600" />;
  }
};

const formatLastHeartbeat = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  
  if (seconds < 60) {
    return `${seconds}s ago`;
  } else if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`;
  } else {
    return `${Math.floor(seconds / 3600)}h ago`;
  }
};

export const ClusterStatus: React.FC<ClusterStatusProps> = ({
  autoRefresh = true,
  refreshInterval = 30000,
}) => {
  const {
    data: clusterMetrics,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useClusterStatus({
    refetchInterval: autoRefresh ? refreshInterval : undefined,
  });

  const handleRefresh = () => {
    refetch();
  };

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Cluster Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="h-4 w-4" />
            <span>Failed to load cluster status: {error?.message}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="mt-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const healthyWorkers = clusterMetrics?.workers.filter(w => w.status === 'healthy').length || 0;
  const totalWorkers = clusterMetrics?.workers.length || 0;
  const overallHealth = totalWorkers > 0 ? (healthyWorkers / totalWorkers) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cluster Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : `${Math.round(overallHealth)}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              {healthyWorkers} of {totalWorkers} workers healthy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Queries</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : clusterMetrics?.activeQueries || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently executing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Load</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : `${Math.round((clusterMetrics?.systemLoad || 0) * 100)}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              Average across workers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : `${Math.round((clusterMetrics?.memoryUsage || 0) * 100)}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              Average across workers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Worker Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Worker Status
              </CardTitle>
              <CardDescription>
                Individual worker health and performance metrics
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefetching}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse" />
                    <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : clusterMetrics?.workers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No workers registered</p>
              <p className="text-sm">Workers will appear here once they connect to the cluster</p>
            </div>
          ) : (
            <div className="space-y-4">
              {clusterMetrics?.workers.map((worker) => (
                <div
                  key={worker.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(worker.status)}
                      <span className="font-medium">{worker.id}</span>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`${getStatusColor(worker.status)} text-white`}
                    >
                      {worker.status}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                    <div className="text-center">
                      <div className="font-medium">CPU</div>
                      <div>{Math.round(worker.cpuUsage * 100)}%</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium">Memory</div>
                      <div>{Math.round(worker.memoryUsage * 100)}%</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium">Last Seen</div>
                      <div>{formatLastHeartbeat(new Date(worker.lastHeartbeat))}</div>
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