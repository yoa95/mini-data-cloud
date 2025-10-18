import React, { useCallback } from 'react';
import { useUploadFile } from '../hooks/api';

export interface UploadPageProps {}

const UploadPage: React.FC<UploadPageProps> = () => {
  const uploadFile = useUploadFile();

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    uploadFile.mutate(
      { file },
      {
        onSuccess: (result) => {
          console.log('Upload successful:', result);
        },
        onError: (error) => {
          console.error('Upload failed:', error);
        },
      }
    );
  }, [uploadFile]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {/* <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <div className="aspect-video rounded-xl bg-muted/50" />
        <div className="aspect-video rounded-xl bg-muted/50" />
        <div className="aspect-video rounded-xl bg-muted/50" />
      </div> */}
      <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min">
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4">Upload Data</h1>
          <p className="text-muted-foreground mb-6">
            Upload CSV files to create tables in Mini Data Cloud.
          </p>
          
          <div className="space-y-4">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={uploadFile.isPending}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            
            {uploadFile.isPending && (
              <p className="text-blue-600">Uploading file...</p>
            )}
            
            {uploadFile.isError && (
              <p className="text-red-600">
                Upload failed: {uploadFile.error?.message}
              </p>
            )}
            
            {uploadFile.isSuccess && (
              <p className="text-green-600">
                File uploaded successfully! Table created: {uploadFile.data?.tableName}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;