import { useState, useEffect } from 'react';

export type ConnectionState = 'connected' | 'disconnected' | 'connecting';

// Simple connection status hook that doesn't rely on WebSocket
export const useConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionState] = useState<ConnectionState>('connected'); // Assume connected for now
  const [isConnected] = useState(true); // Assume connected for now

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