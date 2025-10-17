import { useCallback, useEffect, useState } from 'react';
import ErrorRecoveryService, { type RecoveryAttempt, type RecoveryOptions } from '@/lib/error-recovery';
import { ErrorType } from '@/components/ui/ErrorBoundary';

interface UseErrorRecoveryReturn {
  isRecovering: boolean;
  recoveryAttempts: RecoveryAttempt[];
  attemptRecovery: (error: Error, errorType: ErrorType, options?: RecoveryOptions) => Promise<boolean>;
  clearHistory: () => void;
  recoveryStats: {
    totalAttempts: number;
    successRate: number;
    averageDuration: number;
    strategiesUsed: string[];
  };
}

export const useErrorRecovery = (): UseErrorRecoveryReturn => {
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryAttempts, setRecoveryAttempts] = useState<RecoveryAttempt[]>([]);
  const recoveryService = ErrorRecoveryService.getInstance();

  // Update recovery attempts when they change
  useEffect(() => {
    const updateAttempts = () => {
      setRecoveryAttempts(recoveryService.getRecoveryHistory());
    };

    // Initial load
    updateAttempts();

    // Listen for recovery events
    const handleRecoveryAttempt = () => updateAttempts();
    window.addEventListener('recovery-attempt', handleRecoveryAttempt);

    return () => {
      window.removeEventListener('recovery-attempt', handleRecoveryAttempt);
    };
  }, [recoveryService]);

  const attemptRecovery = useCallback(async (
    error: Error,
    errorType: ErrorType,
    options?: RecoveryOptions
  ): Promise<boolean> => {
    setIsRecovering(true);
    
    try {
      const enhancedOptions: RecoveryOptions = {
        ...options,
        onRecoveryAttempt: (attempt) => {
          // Update local state
          setRecoveryAttempts(prev => [...prev, attempt]);
          
          // Dispatch event for other components
          window.dispatchEvent(new CustomEvent('recovery-attempt', { 
            detail: attempt 
          }));
          
          // Call original callback if provided
          options?.onRecoveryAttempt?.(attempt);
        }
      };

      const success = await recoveryService.attemptRecovery(error, errorType, enhancedOptions);
      return success;
    } finally {
      setIsRecovering(false);
    }
  }, [recoveryService]);

  const clearHistory = useCallback(() => {
    recoveryService.clearHistory();
    setRecoveryAttempts([]);
  }, [recoveryService]);

  const recoveryStats = recoveryService.getRecoveryStats();

  return {
    isRecovering,
    recoveryAttempts,
    attemptRecovery,
    clearHistory,
    recoveryStats
  };
};

// Hook for automatic error recovery in components
export const useAutoErrorRecovery = (
  errorType?: ErrorType,
  options?: RecoveryOptions
) => {
  const { attemptRecovery } = useErrorRecovery();

  const handleError = useCallback(async (error: Error) => {
    if (errorType) {
      console.log(`🔄 Auto-recovering from ${errorType} error:`, error.message);
      const recovered = await attemptRecovery(error, errorType, options);
      
      if (recovered) {
        console.log('✅ Auto-recovery successful');
      } else {
        console.log('❌ Auto-recovery failed');
      }
      
      return recovered;
    }
    return false;
  }, [attemptRecovery, errorType, options]);

  return { handleError };
};

// Hook for monitoring recovery status across the app
export const useRecoveryMonitor = () => {
  const [isAnyRecovering, setIsAnyRecovering] = useState(false);
  const [recentAttempts, setRecentAttempts] = useState<RecoveryAttempt[]>([]);

  useEffect(() => {
    const handleRecoveryStart = () => setIsAnyRecovering(true);
    const handleRecoveryEnd = () => setIsAnyRecovering(false);
    const handleRecoveryAttempt = (event: CustomEvent<RecoveryAttempt>) => {
      setRecentAttempts(prev => [event.detail, ...prev.slice(0, 9)]); // Keep last 10
    };

    window.addEventListener('recovery-start', handleRecoveryStart);
    window.addEventListener('recovery-end', handleRecoveryEnd);
    window.addEventListener('recovery-attempt', handleRecoveryAttempt as EventListener);

    return () => {
      window.removeEventListener('recovery-start', handleRecoveryStart);
      window.removeEventListener('recovery-end', handleRecoveryEnd);
      window.removeEventListener('recovery-attempt', handleRecoveryAttempt as EventListener);
    };
  }, []);

  return {
    isAnyRecovering,
    recentAttempts
  };
};