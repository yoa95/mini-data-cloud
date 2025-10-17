import { 
  useQuery, 
  type UseQueryOptions,
} from '@tanstack/react-query';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { SystemHealth } from '@/types/api';

// System health and monitoring hooks

export const useSystemHealth = (
  options?: Omit<UseQueryOptions<SystemHealth, ApiClientError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.systemHealth(),
    queryFn: () => apiClient.getSystemHealth(),
    refetchInterval: 10000, // Refresh every 10 seconds
    retry: (failureCount, error) => {
      // Don't retry too aggressively for health checks
      return failureCount < 2;
    },
    ...options,
  });
};

// Utility hooks for system monitoring

export const useSystemStatus = () => {
  const { data: health, isLoading, error } = useSystemHealth();
  
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'UP':
        return 'green';
      case 'DEGRADED':
        return 'yellow';
      case 'DOWN':
        return 'red';
      default:
        return 'gray';
    }
  };
  
  const getStatusText = (status?: string) => {
    switch (status) {
      case 'UP':
        return 'Healthy';
      case 'DEGRADED':
        return 'Degraded';
      case 'DOWN':
        return 'Down';
      default:
        return 'Unknown';
    }
  };
  
  const formatUptime = (uptimeMs?: number) => {
    if (!uptimeMs) return 'Unknown';
    
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };
  
  const getMemoryUsagePercentage = () => {
    if (!health?.memoryUsage) return 0;
    return (health.memoryUsage.used / health.memoryUsage.total) * 100;
  };
  
  const isMemoryHigh = () => {
    return getMemoryUsagePercentage() > 80;
  };
  
  const isMemoryCritical = () => {
    return getMemoryUsagePercentage() > 95;
  };
  
  return {
    health,
    isLoading,
    error,
    isHealthy: health?.status === 'UP',
    isDegraded: health?.status === 'DEGRADED',
    isDown: health?.status === 'DOWN' || !!error,
    statusColor: getStatusColor(health?.status),
    statusText: getStatusText(health?.status),
    formattedUptime: formatUptime(health?.uptime),
    memoryUsagePercentage: getMemoryUsagePercentage(),
    isMemoryHigh: isMemoryHigh(),
    isMemoryCritical: isMemoryCritical(),
  };
};

export const useSystemAlerts = () => {
  const { health, error } = useSystemHealth();
  
  const alerts: Array<{
    id: string;
    type: 'error' | 'warning' | 'info';
    title: string;
    message: string;
    timestamp: Date;
  }> = [];
  
  // System down alert
  if (error || health?.status === 'DOWN') {
    alerts.push({
      id: 'system-down',
      type: 'error',
      title: 'System Down',
      message: 'The control plane is not responding. Please check system status.',
      timestamp: new Date(),
    });
  }
  
  // System degraded alert
  if (health?.status === 'DEGRADED') {
    alerts.push({
      id: 'system-degraded',
      type: 'warning',
      title: 'System Degraded',
      message: 'The system is experiencing performance issues.',
      timestamp: new Date(),
    });
  }
  
  // High memory usage alert
  if (health?.memoryUsage) {
    const memoryPercentage = (health.memoryUsage.used / health.memoryUsage.total) * 100;
    
    if (memoryPercentage > 95) {
      alerts.push({
        id: 'memory-critical',
        type: 'error',
        title: 'Critical Memory Usage',
        message: `Memory usage is at ${memoryPercentage.toFixed(1)}%. System may become unstable.`,
        timestamp: new Date(),
      });
    } else if (memoryPercentage > 80) {
      alerts.push({
        id: 'memory-high',
        type: 'warning',
        title: 'High Memory Usage',
        message: `Memory usage is at ${memoryPercentage.toFixed(1)}%. Consider monitoring closely.`,
        timestamp: new Date(),
      });
    }
  }
  
  return {
    alerts,
    hasAlerts: alerts.length > 0,
    errorCount: alerts.filter(a => a.type === 'error').length,
    warningCount: alerts.filter(a => a.type === 'warning').length,
    infoCount: alerts.filter(a => a.type === 'info').length,
  };
};