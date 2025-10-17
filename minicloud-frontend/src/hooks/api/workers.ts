import { 
  useQuery, 
  type UseQueryOptions,
} from '@tanstack/react-query';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type {
  WorkerInfo,
  ClusterStats,
  WorkerStatus,
} from '@/types/api';

// Worker management and monitoring hooks

export const useWorkers = (
  status?: WorkerStatus,
  options?: Omit<UseQueryOptions<WorkerInfo[], ApiClientError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.allWorkers(status),
    queryFn: () => apiClient.getWorkers(status),
    refetchInterval: 5000, // Refresh every 5 seconds
    ...options,
  });
};

export const useWorker = (
  workerId: string,
  options?: Omit<UseQueryOptions<WorkerInfo, ApiClientError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.worker(workerId),
    queryFn: () => apiClient.getWorker(workerId),
    enabled: !!workerId,
    refetchInterval: 3000, // Refresh every 3 seconds for individual worker
    ...options,
  });
};

export const useHealthyWorkers = (
  options?: Omit<UseQueryOptions<WorkerInfo[], ApiClientError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.healthyWorkers(),
    queryFn: () => apiClient.getHealthyWorkers(),
    refetchInterval: 5000, // Refresh every 5 seconds
    ...options,
  });
};

export const useClusterStats = (
  options?: Omit<UseQueryOptions<ClusterStats, ApiClientError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.clusterStats(),
    queryFn: () => apiClient.getClusterStats(),
    refetchInterval: 10000, // Refresh every 10 seconds
    ...options,
  });
};

// Utility hooks for worker analysis

export const useWorkersByStatus = () => {
  const { data: workers, ...rest } = useWorkers();
  
  const workersByStatus = workers?.reduce((acc, worker) => {
    if (!acc[worker.status]) {
      acc[worker.status] = [];
    }
    acc[worker.status].push(worker);
    return acc;
  }, {} as Record<WorkerStatus, WorkerInfo[]>) || {};
  
  return {
    data: workersByStatus,
    healthy: workersByStatus.HEALTHY || [],
    unhealthy: workersByStatus.UNHEALTHY || [],
    draining: workersByStatus.DRAINING || [],
    starting: workersByStatus.STARTING || [],
    ...rest,
  };
};

export const useWorkerMetrics = () => {
  const { data: workers, ...rest } = useWorkers();
  
  if (!workers || workers.length === 0) {
    return {
      data: null,
      totalCpuCores: 0,
      totalMemoryMb: 0,
      avgCpuUtilization: 0,
      avgMemoryUtilization: 0,
      totalActiveQueries: 0,
      ...rest,
    };
  }
  
  const totalCpuCores = workers.reduce((sum, worker) => sum + worker.resources.cpuCores, 0);
  const totalMemoryMb = workers.reduce((sum, worker) => sum + worker.resources.memoryMb, 0);
  const avgCpuUtilization = workers.reduce((sum, worker) => sum + worker.resources.cpuUtilization, 0) / workers.length;
  const avgMemoryUtilization = workers.reduce((sum, worker) => sum + worker.resources.memoryUtilization, 0) / workers.length;
  const totalActiveQueries = workers.reduce((sum, worker) => sum + worker.resources.activeQueries, 0);
  
  return {
    data: {
      totalCpuCores,
      totalMemoryMb,
      avgCpuUtilization,
      avgMemoryUtilization,
      totalActiveQueries,
      workerCount: workers.length,
    },
    totalCpuCores,
    totalMemoryMb,
    avgCpuUtilization,
    avgMemoryUtilization,
    totalActiveQueries,
    ...rest,
  };
};

export const useWorkerHealth = () => {
  const { data: clusterStats } = useClusterStats();
  const { data: workers } = useWorkers();
  
  if (!clusterStats || !workers) {
    return {
      isHealthy: false,
      healthPercentage: 0,
      issues: [],
    };
  }
  
  const healthPercentage = clusterStats.totalWorkers > 0 
    ? (clusterStats.healthyWorkers / clusterStats.totalWorkers) * 100 
    : 0;
  
  const issues: string[] = [];
  
  if (clusterStats.unhealthyWorkers > 0) {
    issues.push(`${clusterStats.unhealthyWorkers} unhealthy workers`);
  }
  
  if (clusterStats.drainingWorkers > 0) {
    issues.push(`${clusterStats.drainingWorkers} workers draining`);
  }
  
  // Check for workers with high resource utilization
  const highCpuWorkers = workers.filter(w => w.resources.cpuUtilization > 90);
  const highMemoryWorkers = workers.filter(w => w.resources.memoryUtilization > 90);
  
  if (highCpuWorkers.length > 0) {
    issues.push(`${highCpuWorkers.length} workers with high CPU usage`);
  }
  
  if (highMemoryWorkers.length > 0) {
    issues.push(`${highMemoryWorkers.length} workers with high memory usage`);
  }
  
  // Check for stale heartbeats (older than 30 seconds)
  const now = Date.now();
  const staleWorkers = workers.filter(w => (now - w.lastHeartbeatMs) > 30000);
  
  if (staleWorkers.length > 0) {
    issues.push(`${staleWorkers.length} workers with stale heartbeats`);
  }
  
  return {
    isHealthy: healthPercentage >= 80 && issues.length === 0,
    healthPercentage,
    issues,
    clusterStats,
  };
};

export const useWorkerLoadBalancing = () => {
  const { data: workers } = useWorkers();
  
  if (!workers || workers.length === 0) {
    return {
      isBalanced: true,
      loadVariance: 0,
      recommendations: [],
    };
  }
  
  const activeQueries = workers.map(w => w.resources.activeQueries);
  const avgQueries = activeQueries.reduce((sum, q) => sum + q, 0) / workers.length;
  const variance = activeQueries.reduce((sum, q) => sum + Math.pow(q - avgQueries, 2), 0) / workers.length;
  const standardDeviation = Math.sqrt(variance);
  
  const recommendations: string[] = [];
  
  // Check for load imbalance
  const maxQueries = Math.max(...activeQueries);
  const minQueries = Math.min(...activeQueries);
  
  if (maxQueries - minQueries > 5 && workers.length > 1) {
    recommendations.push('Consider redistributing queries across workers');
  }
  
  // Check for overloaded workers
  const overloadedWorkers = workers.filter(w => 
    w.resources.activeQueries > avgQueries + (2 * standardDeviation)
  );
  
  if (overloadedWorkers.length > 0) {
    recommendations.push(`${overloadedWorkers.length} workers are handling significantly more queries than average`);
  }
  
  // Check for underutilized workers
  const underutilizedWorkers = workers.filter(w => 
    w.resources.activeQueries === 0 && w.status === 'HEALTHY'
  );
  
  if (underutilizedWorkers.length > 0 && avgQueries > 1) {
    recommendations.push(`${underutilizedWorkers.length} healthy workers are idle`);
  }
  
  return {
    isBalanced: standardDeviation < 2,
    loadVariance: variance,
    standardDeviation,
    avgQueries,
    maxQueries,
    minQueries,
    recommendations,
  };
};