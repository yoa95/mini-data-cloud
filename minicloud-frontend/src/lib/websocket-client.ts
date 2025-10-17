import { io, Socket } from 'socket.io-client';
import type { QueryResponse, WorkerInfo, ClusterStats, SystemHealth } from '@/types/api';

// WebSocket event types
export interface ServerToClientEvents {
  // Query events
  'query-progress': (data: QueryProgressUpdate) => void;
  'query-status-change': (data: QueryStatusUpdate) => void;
  'query-completed': (data: QueryResponse) => void;
  'query-failed': (data: QueryResponse) => void;
  
  // Worker events
  'worker-status-change': (data: WorkerStatusUpdate) => void;
  'worker-added': (data: WorkerInfo) => void;
  'worker-removed': (data: { workerId: string }) => void;
  'worker-heartbeat': (data: WorkerHeartbeat) => void;
  
  // System events
  'system-health-update': (data: SystemHealth) => void;
  'cluster-stats-update': (data: ClusterStats) => void;
  'system-alert': (data: SystemAlert) => void;
  
  // Connection events
  'connect': () => void;
  'disconnect': (reason: string) => void;
  'reconnect': (attemptNumber: number) => void;
  'reconnect_error': (error: Error) => void;
}

export interface ClientToServerEvents {
  // Query subscriptions
  'subscribe-query-progress': (queryId: string) => void;
  'unsubscribe-query-progress': (queryId: string) => void;
  'subscribe-query-status': (queryId: string) => void;
  'unsubscribe-query-status': (queryId: string) => void;
  
  // Worker subscriptions
  'subscribe-worker-updates': () => void;
  'unsubscribe-worker-updates': () => void;
  'subscribe-worker-status': (workerId: string) => void;
  'unsubscribe-worker-status': (workerId: string) => void;
  
  // System subscriptions
  'subscribe-system-health': () => void;
  'unsubscribe-system-health': () => void;
  'subscribe-cluster-stats': () => void;
  'unsubscribe-cluster-stats': () => void;
  
  // Heartbeat
  'ping': () => void;
}

// Event data types
export interface QueryProgressUpdate {
  queryId: string;
  stage: string;
  progress: number; // 0-100
  currentWorker?: string;
  estimatedRemainingMs?: number;
  message?: string;
}

export interface QueryStatusUpdate {
  queryId: string;
  status: QueryResponse['status'];
  timestamp: string;
  message?: string;
}

export interface WorkerStatusUpdate {
  workerId: string;
  status: WorkerInfo['status'];
  timestamp: string;
  reason?: string;
}

export interface WorkerHeartbeat {
  workerId: string;
  timestamp: string;
  resources: WorkerInfo['resources'];
}

export interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  source: string;
}

// Connection state
export type ConnectionState = 
  | 'disconnected' 
  | 'connecting' 
  | 'connected' 
  | 'reconnecting' 
  | 'error';

// WebSocket client configuration
interface WebSocketConfig {
  url: string;
  autoConnect: boolean;
  reconnection: boolean;
  reconnectionAttempts: number;
  reconnectionDelay: number;
  reconnectionDelayMax: number;
  timeout: number;
}

const DEFAULT_CONFIG: WebSocketConfig = {
  url: import.meta.env['VITE_WS_URL'] || 'ws://localhost:8080',
  autoConnect: false, // Don't auto-connect since backend doesn't have WebSocket yet
  reconnection: true,
  reconnectionAttempts: 3, // Reduce attempts to avoid spam
  reconnectionDelay: 5000, // Increase delay
  reconnectionDelayMax: 30000, // Increase max delay
  timeout: 10000, // Reduce timeout
};

// WebSocket client class
export class WebSocketClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private config: WebSocketConfig;
  private connectionState: ConnectionState = 'disconnected';
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private subscriptions: Set<string> = new Set();

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Connection management
  connect(): void {
    // Check if WebSocket is enabled
    const wsEnabled = import.meta.env['VITE_ENABLE_WEBSOCKET'] === 'true';
    if (!wsEnabled) {
      console.info('WebSocket is disabled in environment configuration');
      return;
    }

    if (this.socket?.connected) {
      return;
    }

    this.connectionState = 'connecting';
    
    this.socket = io(this.config.url, {
      autoConnect: this.config.autoConnect,
      reconnection: this.config.reconnection,
      reconnectionAttempts: this.config.reconnectionAttempts,
      reconnectionDelay: this.config.reconnectionDelay,
      reconnectionDelayMax: this.config.reconnectionDelayMax,
      timeout: this.config.timeout,
    });

    this.setupEventHandlers();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connectionState = 'disconnected';
    this.subscriptions.clear();
  }

  // Connection state
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // Event handling
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      this.connectionState = 'connected';
      this.emit('connection-state-change', 'connected');
      
      // Resubscribe to previous subscriptions
      this.resubscribe();
    });

    this.socket.on('disconnect', (reason) => {
      this.connectionState = 'disconnected';
      this.emit('connection-state-change', 'disconnected', reason);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      this.connectionState = 'connected';
      this.emit('connection-state-change', 'connected');
      this.emit('reconnected', attemptNumber);
    });

    this.socket.on('reconnect_error', (error) => {
      this.connectionState = 'error';
      this.emit('connection-state-change', 'error', error);
    });

    // Forward all server events to listeners
    const events: (keyof ServerToClientEvents)[] = [
      'query-progress',
      'query-status-change',
      'query-completed',
      'query-failed',
      'worker-status-change',
      'worker-added',
      'worker-removed',
      'worker-heartbeat',
      'system-health-update',
      'cluster-stats-update',
      'system-alert',
    ];

    events.forEach(event => {
      this.socket!.on(event, (...args) => {
        this.emit(event, ...args);
      });
    });
  }

  // Event listener management
  on<K extends keyof ServerToClientEvents>(
    event: K,
    listener: ServerToClientEvents[K]
  ): void;
  on(event: string, listener: (...args: any[]) => void): void;
  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off<K extends keyof ServerToClientEvents>(
    event: K,
    listener: ServerToClientEvents[K]
  ): void;
  off(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  private emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in WebSocket event listener for ${event}:`, error);
        }
      });
    }
  }

  // Subscription management
  subscribeToQueryProgress(queryId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('subscribe-query-progress', queryId);
      this.subscriptions.add(`query-progress:${queryId}`);
    }
  }

  unsubscribeFromQueryProgress(queryId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe-query-progress', queryId);
    }
    this.subscriptions.delete(`query-progress:${queryId}`);
  }

  subscribeToQueryStatus(queryId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('subscribe-query-status', queryId);
      this.subscriptions.add(`query-status:${queryId}`);
    }
  }

  unsubscribeFromQueryStatus(queryId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe-query-status', queryId);
    }
    this.subscriptions.delete(`query-status:${queryId}`);
  }

  subscribeToWorkerUpdates(): void {
    if (this.socket?.connected) {
      this.socket.emit('subscribe-worker-updates');
      this.subscriptions.add('worker-updates');
    }
  }

  unsubscribeFromWorkerUpdates(): void {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe-worker-updates');
    }
    this.subscriptions.delete('worker-updates');
  }

  subscribeToWorkerStatus(workerId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('subscribe-worker-status', workerId);
      this.subscriptions.add(`worker-status:${workerId}`);
    }
  }

  unsubscribeFromWorkerStatus(workerId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe-worker-status', workerId);
    }
    this.subscriptions.delete(`worker-status:${workerId}`);
  }

  subscribeToSystemHealth(): void {
    if (this.socket?.connected) {
      this.socket.emit('subscribe-system-health');
      this.subscriptions.add('system-health');
    }
  }

  unsubscribeFromSystemHealth(): void {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe-system-health');
    }
    this.subscriptions.delete('system-health');
  }

  subscribeToClusterStats(): void {
    if (this.socket?.connected) {
      this.socket.emit('subscribe-cluster-stats');
      this.subscriptions.add('cluster-stats');
    }
  }

  unsubscribeFromClusterStats(): void {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe-cluster-stats');
    }
    this.subscriptions.delete('cluster-stats');
  }

  // Resubscribe to all previous subscriptions (used after reconnection)
  private resubscribe(): void {
    this.subscriptions.forEach(subscription => {
      const [type, id] = subscription.split(':');
      
      switch (type) {
        case 'query-progress':
          this.socket?.emit('subscribe-query-progress', id);
          break;
        case 'query-status':
          this.socket?.emit('subscribe-query-status', id);
          break;
        case 'worker-updates':
          this.socket?.emit('subscribe-worker-updates');
          break;
        case 'worker-status':
          this.socket?.emit('subscribe-worker-status', id);
          break;
        case 'system-health':
          this.socket?.emit('subscribe-system-health');
          break;
        case 'cluster-stats':
          this.socket?.emit('subscribe-cluster-stats');
          break;
      }
    });
  }

  // Utility methods
  ping(): void {
    if (this.socket?.connected) {
      this.socket.emit('ping');
    }
  }

  // Get socket instance (for advanced usage)
  getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
    return this.socket;
  }
}

// Create default instance
export const webSocketClient = new WebSocketClient();