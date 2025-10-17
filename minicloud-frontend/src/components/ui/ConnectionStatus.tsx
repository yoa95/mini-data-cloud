import React from 'react';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';

interface ConnectionStatusProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  className,
  showText = false,
  size = 'md',
}) => {
  const { isOnline, isConnected, connectionState, isFullyConnected } = useConnectionStatus();

  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        color: 'text-red-500',
        bgColor: 'bg-red-100 dark:bg-red-900/20',
        text: 'Offline',
        description: 'No internet connection',
      };
    }

    switch (connectionState) {
      case 'connected':
        return {
          icon: CheckCircle,
          color: 'text-green-500',
          bgColor: 'bg-green-100 dark:bg-green-900/20',
          text: 'Connected',
          description: 'Real-time updates active',
        };
      case 'connecting':
      case 'reconnecting':
        return {
          icon: Loader2,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
          text: connectionState === 'connecting' ? 'Connecting' : 'Reconnecting',
          description: 'Establishing connection...',
          animate: true,
        };
      case 'disconnected':
        return {
          icon: AlertCircle,
          color: 'text-orange-500',
          bgColor: 'bg-orange-100 dark:bg-orange-900/20',
          text: 'Disconnected',
          description: 'Real-time updates unavailable',
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-red-500',
          bgColor: 'bg-red-100 dark:bg-red-900/20',
          text: 'Error',
          description: 'Connection failed',
        };
      default:
        return {
          icon: Wifi,
          color: 'text-gray-500',
          bgColor: 'bg-gray-100 dark:bg-gray-900/20',
          text: 'Unknown',
          description: 'Connection status unknown',
        };
    }
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const containerSizeClasses = {
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  if (showText) {
    return (
      <div
        className={cn(
          'flex items-center space-x-2 rounded-md px-3 py-1.5',
          statusInfo.bgColor,
          className
        )}
        title={statusInfo.description}
      >
        <Icon
          className={cn(
            sizeClasses[size],
            statusInfo.color,
            statusInfo.animate && 'animate-spin'
          )}
        />
        <span className={cn(textSizeClasses[size], statusInfo.color)}>
          {statusInfo.text}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full',
        containerSizeClasses[size],
        statusInfo.bgColor,
        className
      )}
      title={`${statusInfo.text}: ${statusInfo.description}`}
    >
      <Icon
        className={cn(
          sizeClasses[size],
          statusInfo.color,
          statusInfo.animate && 'animate-spin'
        )}
      />
    </div>
  );
};

// Compact version for status bars
export const ConnectionStatusBadge: React.FC<{
  className?: string;
}> = ({ className }) => {
  const { isFullyConnected } = useConnectionStatus();

  return (
    <div
      className={cn(
        'h-2 w-2 rounded-full',
        isFullyConnected ? 'bg-green-500' : 'bg-red-500',
        className
      )}
      title={isFullyConnected ? 'Connected' : 'Disconnected'}
    />
  );
};