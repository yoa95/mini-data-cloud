import { useState, useCallback, useRef } from 'react';
import type { UploadStatus } from '../types/api';
import { useUploadFile } from './api';

export interface UploadQueueItem extends UploadStatus {
  file: File;
  id: string;
}

export interface UseUploadQueueReturn {
  uploads: UploadQueueItem[];
  addFiles: (files: File[]) => void;
  cancelUpload: (fileName: string) => void;
  retryUpload: (fileName: string) => void;
  clearCompleted: () => void;
  isUploading: boolean;
}

export const useUploadQueue = (): UseUploadQueueReturn => {
  const [uploads, setUploads] = useState<UploadQueueItem[]>([]);
  const uploadFile = useUploadFile();
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const generateId = () => `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const updateUpload = useCallback((fileName: string, updates: Partial<UploadQueueItem>) => {
    setUploads(prev => prev.map(upload => 
      upload.fileName === fileName 
        ? { ...upload, ...updates }
        : upload
    ));
  }, []);

  const processUpload = useCallback(async (uploadItem: UploadQueueItem, retryCount = 0) => {
    const { file, fileName } = uploadItem;
    const maxRetries = 3;
    
    // Create abort controller for this upload
    const abortController = new AbortController();
    abortControllersRef.current.set(fileName, abortController);

    try {
      // Update status to uploading
      updateUpload(fileName, { status: 'uploading', progress: 0 });

      // Start upload with progress tracking
      const result = await uploadFile.mutateAsync({
        file,
        onProgress: (progress: number) => {
          updateUpload(fileName, { progress });
        }
      });

      // Check if upload was cancelled
      if (abortController.signal.aborted) {
        return;
      }

      // Update to processing state
      updateUpload(fileName, { status: 'processing', progress: 100 });

      // Simulate processing delay (in real app, this would be handled by backend)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check again if cancelled during processing
      if (abortController.signal.aborted) {
        return;
      }

      // Mark as completed
      updateUpload(fileName, {
        status: 'completed',
        progress: 100,
        tableCreated: result.tableName,
      });

    } catch (error) {
      // Don't update if cancelled
      if (abortController.signal.aborted) {
        return;
      }

      // Retry logic for network errors
      if (retryCount < maxRetries && shouldRetryError(error)) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        setTimeout(() => {
          processUpload(uploadItem, retryCount + 1);
        }, delay);
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      updateUpload(fileName, {
        status: 'error',
        error: retryCount > 0 
          ? `${errorMessage} (after ${retryCount} retries)`
          : errorMessage,
      });
    } finally {
      // Clean up abort controller
      abortControllersRef.current.delete(fileName);
    }
  }, [uploadFile, updateUpload]);

  const shouldRetryError = (error: unknown): boolean => {
    if (error instanceof Error) {
      // Retry on network errors, timeouts, and 5xx server errors
      return error.message.includes('Network error') ||
             error.message.includes('timeout') ||
             error.message.includes('HTTP 5');
    }
    return false;
  };

  const addFiles = useCallback((files: File[]) => {
    const newUploads: UploadQueueItem[] = files.map(file => ({
      id: generateId(),
      file,
      fileName: file.name,
      progress: 0,
      status: 'pending' as const,
    }));

    setUploads(prev => [...prev, ...newUploads]);

    // Start processing uploads
    newUploads.forEach(upload => {
      // Small delay to show pending state
      setTimeout(() => {
        processUpload(upload, 0);
      }, 100);
    });
  }, [processUpload]);

  const cancelUpload = useCallback((fileName: string) => {
    // Cancel the upload via abort controller
    const abortController = abortControllersRef.current.get(fileName);
    if (abortController) {
      abortController.abort();
    }

    // Remove from uploads list
    setUploads(prev => prev.filter(upload => upload.fileName !== fileName));
  }, []);

  const retryUpload = useCallback((fileName: string) => {
    const upload = uploads.find(u => u.fileName === fileName);
    if (!upload) return;

    // Reset upload status
    updateUpload(fileName, {
      status: 'pending',
      progress: 0,
      error: undefined,
    });

    // Restart upload
    setTimeout(() => {
      processUpload(upload, 0);
    }, 100);
  }, [uploads, updateUpload, processUpload]);

  const clearCompleted = useCallback(() => {
    setUploads(prev => prev.filter(upload => upload.status !== 'completed'));
  }, []);

  const isUploading = uploads.some(upload => 
    upload.status === 'uploading' || 
    upload.status === 'processing' || 
    upload.status === 'pending'
  );

  return {
    uploads,
    addFiles,
    cancelUpload,
    retryUpload,
    clearCompleted,
    isUploading,
  };
};