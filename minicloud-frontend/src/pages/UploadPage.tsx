import React from 'react';
import FileUploadZone from '../components/upload/FileUploadZone';
import UploadProgress from '../components/upload/UploadProgress';
import { useUploadQueue } from '../hooks/useUploadQueue';

export interface UploadPageProps {}

const UploadPage: React.FC<UploadPageProps> = () => {
  const {
    uploads,
    addFiles,
    cancelUpload,
    retryUpload,
    clearCompleted,
    isUploading,
  } = useUploadQueue();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Upload Data</h1>
        <p className="text-muted-foreground">
          Upload CSV files to create tables in Mini Data Cloud. Files will be automatically 
          converted to Parquet format and made available for querying.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload Zone */}
        <div className="space-y-4">
          <FileUploadZone
            onFilesSelected={addFiles}
            disabled={isUploading}
            maxFiles={10}
            maxSizeBytes={100 * 1024 * 1024} // 100MB
          />
          
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• CSV files will be automatically processed and converted to Parquet format</p>
            <p>• Table names will be derived from file names (without extension)</p>
            <p>• Column types will be automatically inferred from the data</p>
            <p>• Maximum file size: 100MB per file</p>
          </div>
        </div>

        {/* Upload Progress */}
        <div className="space-y-4">
          {uploads.length > 0 && (
            <UploadProgress
              uploads={uploads}
              onCancelUpload={cancelUpload}
              onRetryUpload={retryUpload}
              onClearCompleted={clearCompleted}
            />
          )}
          
          {uploads.length === 0 && (
            <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted-foreground/25 rounded-lg">
              <div className="text-center space-y-2">
                <p className="text-muted-foreground">No uploads yet</p>
                <p className="text-sm text-muted-foreground">
                  Select files to see upload progress here
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadPage;