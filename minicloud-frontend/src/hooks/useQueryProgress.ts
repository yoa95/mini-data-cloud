import { useState } from 'react';

interface QueryProgress {
  queryId: string;
  stage: string;
  progress: number; // 0-100
  currentWorker?: string;
  estimatedRemainingMs?: number;
  message?: string;
}

interface UseQueryProgressOptions {
  enabled?: boolean;
  onProgress?: (progress: QueryProgress) => void;
  onComplete?: (queryId: string) => void;
  onError?: (queryId: string, error: string) => void;
}

export const useQueryProgress = (
  queryId: string | null,
  options: UseQueryProgressOptions = {}
) => {
  const [progress] = useState<QueryProgress | null>(null);
  const [isTracking] = useState(false);

  // TODO: Implement WebSocket-based progress tracking
  // For now, return mock data to prevent build errors

  return {
    progress,
    isTracking,
    isConnected: false,
  };
};

export default useQueryProgress;