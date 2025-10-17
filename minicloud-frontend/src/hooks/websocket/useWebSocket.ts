import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  webSocketClient, 
  type ConnectionState, 
  type ServerToClientEvents 
} from '@/lib/websocket-client';
import { queryKeys } from '@/lib/query-keys';
import { useErrorNotification, useInfoNotification } from '@/store/notification-store';

// Base WebSocket hook
export const useWebSocket = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const showError = useErrorNotification();
  const showInfo = useInfoNotification();

  useEffect(() => {
    // Connect on mount
    webSocketClient.connect();

    // Set up connection state listeners
    const handleConnectionStateChange = (state: ConnectionState, ...args: any[]) => {
      setConnectionState(state);
      setIsConnected(state === 'connected');

      switch (state) {
        case 'connected':
          setReconnectAttempts(0);
          showInfo('Connected', 'Real-time updates are now active');
          break;
        case 'disconnected':
          showError('Disconnected', 'Real-time updates are unavailable');
          break;
        case 'error':
          showError('Connection Error', 'Failed to connect to real-time updates');
          break;
      }
    };

    const handleReconnected = (attemptNumber: number) => {
      setReconnectAttempts(attemptNumber);
      showInfo('Reconnected', `Reconnected after ${attemptNumber} attempts`);
    };

    webSocketClient.on('connection-state-change', handleConnectionStateChange);
    webSocketClient.on('reconnected', handleReconnected);

    // Update initial state
    setConnectionState(webSocketClient.getConnectionState());
    setIsConnected(webSocketClient.isConnected());

    // Cleanup on unmount
    return () => {
      webSocketClient.off('connection-state-change', handleConnectionStateChange);
      webSocketClient.off('reconnected', handleReconnected);
      webSocketClient.disconnect();
    };
  }, [showError, showInfo]);

  const connect = useCallback(() => {
    webSocketClient.connect();
  }, []);

  const disconnect = useCallback(() => {
    webSocketClient.disconnect();
  }, []);

  return {
    connectionState,
    isConnected,
    reconnectAttempts,
    connect,
    disconnect,
  };
};

// Hook for listening to WebSocket events
export const useWebSocketEvent = <K extends keyof ServerToClientEvents>(
  event: K,
  handler: ServerToClientEvents[K],
  deps: React.DependencyList = []
) => {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const wrappedHandler = (...args: Parameters<ServerToClientEvents[K]>) => {
      handlerRef.current(...args);
    };

    webSocketClient.on(event, wrappedHandler as any);

    return () => {
      webSocketClient.off(event, wrappedHandler as any);
    };
  }, [event, ...deps]);
};

// Hook for real-time query progress updates
export const useRealtimeQueryProgress = (queryId: string) => {
  const [progress, setProgress] = useState<{
    stage?: string;
    progress?: number;
    currentWorker?: string;
    estimatedRemainingMs?: number;
    message?: string;
  }>({});
  const queryClient = useQueryClient();

  useWebSocketEvent('query-progress', (data) => {
    if (data.queryId === queryId) {
      setProgress({
        stage: data.stage,
        progress: data.progress,
        currentWorker: data.currentWorker,
        estimatedRemainingMs: data.estimatedRemainingMs,
        message: data.message,
      });
    }
  }, [queryId]);

  useWebSocketEvent('query-status-change', (data) => {
    if (data.queryId === queryId) {
      // Update query status in cache
      queryClient.setQueryData(
        queryKeys.query(queryId),
        (old: any) => old ? { ...old, status: data.status } : undefined
      );
    }
  }, [queryId, queryClient]);

  useWebSocketEvent('query-completed', (data) => {
    if (data.queryId === queryId) {
      // Update query data in cache
      queryClient.setQueryData(queryKeys.query(queryId), data);
      // Invalidate results to trigger refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.queryResults(queryId) });
    }
  }, [queryId, queryClient]);

  useWebSocketEvent('query-failed', (data) => {
    if (data.queryId === queryId) {
      // Update query data in cache
      queryClient.setQueryData(queryKeys.query(queryId), data);
    }
  }, [queryId, queryClient]);

  useEffect(() => {
    if (queryId && webSocketClient.isConnected()) {
      webSocketClient.subscribeToQueryProgress(queryId);
      webSocketClient.subscribeToQueryStatus(queryId);
    }

    return () => {
      if (queryId) {
        webSocketClient.unsubscribeFromQueryProgress(queryId);
        webSocketClient.unsubscribeFromQueryStatus(queryId);
      }
    };
  }, [queryId]);

  return progress;
};

// Hook for real-time worker updates
export const useRealtimeWorkerUpdates = () => {
  const queryClient = useQueryClient();

  useWebSocketEvent('worker-status-change', (data) => {
    // Update specific worker in cache
    queryClient.setQueryData(
      queryKeys.worker(data.workerId),
      (old: any) => old ? { ...old, status: data.status } : undefined
    );
    
    // Invalidate workers list
    queryClient.invalidateQueries({ queryKey: queryKeys.workers });
    queryClient.invalidateQueries({ queryKey: queryKeys.clusterStats() });
  });

  useWebSocketEvent('worker-added', (data) => {
    // Add new worker to cache
    queryClient.setQueryData(queryKeys.worker(data.workerId), data);
    
    // Invalidate workers list
    queryClient.invalidateQueries({ queryKey: queryKeys.workers });
    queryClient.invalidateQueries({ queryKey: queryKeys.clusterStats() });
  });

  useWebSocketEvent('worker-removed', (data) => {
    // Remove worker from cache
    queryClient.removeQueries({ queryKey: queryKeys.worker(data.workerId) });
    
    // Invalidate workers list
    queryClient.invalidateQueries({ queryKey: queryKeys.workers });
    queryClient.invalidateQueries({ queryKey: queryKeys.clusterStats() });
  });

  useWebSocketEvent('worker-heartbeat', (data) => {
    // Update worker resources in cache
    queryClient.setQueryData(
      queryKeys.worker(data.workerId),
      (old: any) => old ? { 
        ...old, 
        resources: data.resources,
        lastHeartbeatMs: new Date(data.timestamp).getTime()
      } : undefined
    );
  });

  useEffect(() => {
    if (webSocketClient.isConnected()) {
      webSocketClient.subscribeToWorkerUpdates();
    }

    return () => {
      webSocketClient.unsubscribeFromWorkerUpdates();
    };
  }, []);
};

// Hook for real-time system metrics
export const useRealtimeSystemMetrics = () => {
  const queryClient = useQueryClient();

  useWebSocketEvent('system-health-update', (data) => {
    // Update system health in cache
    queryClient.setQueryData(queryKeys.systemHealth(), data);
  });

  useWebSocketEvent('cluster-stats-update', (data) => {
    // Update cluster stats in cache
    queryClient.setQueryData(queryKeys.clusterStats(), data);
  });

  // System alerts will be handled separately to avoid hook issues

  useEffect(() => {
    if (webSocketClient.isConnected()) {
      webSocketClient.subscribeToSystemHealth();
      webSocketClient.subscribeToClusterStats();
    }

    return () => {
      webSocketClient.unsubscribeFromSystemHealth();
      webSocketClient.unsubscribeFromClusterStats();
    };
  }, []);
};

// Hook for connection status with offline detection
export const useConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { connectionState, isConnected } = useWebSocket();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    isConnected,
    connectionState,
    isFullyConnected: isOnline && isConnected,
  };
};