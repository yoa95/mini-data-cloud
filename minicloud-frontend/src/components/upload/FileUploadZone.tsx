import React, { useCallback, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

export interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  maxSizeBytes?: number;
  className?: string;
}

interface DragState {
  isDragOver: boolean;
  isDragActive: boolean;
  isDragReject: boolean;
}

const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  onFilesSelected,
  disabled = false,
  maxFiles = 10,
  maxSizeBytes = 100 * 1024 * 1024, // 100MB default
  className,
}) => {
  const [dragState, setDragState] = useState<DragState>({
    isDragOver: false,
    isDragActive: false,
    isDragReject: false,
  });

  const validateFiles = useCallback((files: FileList | File[]): { valid: File[]; invalid: File[] } => {
    const fileArray = Array.from(files);
    const valid: File[] = [];
    const invalid: File[] = [];

    fileArray.forEach(file => {
      // Check file type (CSV only)
      const isValidType = file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv');
      // Check file size
      const isValidSize = file.size <= maxSizeBytes;
      
      if (isValidType && isValidSize) {
        valid.push(file);
      } else {
        invalid.push(file);
      }
    });

    // Limit to maxFiles
    return {
      valid: valid.slice(0, maxFiles),
      invalid: [...invalid, ...valid.slice(maxFiles)]
    };
  }, [maxFiles, maxSizeBytes]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    const hasValidFiles = files.some(file => 
      (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) &&
      file.size <= maxSizeBytes
    );

    setDragState({
      isDragOver: true,
      isDragActive: true,
      isDragReject: !hasValidFiles || files.length > maxFiles,
    });
  }, [disabled, maxFiles, maxSizeBytes]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only reset if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragState({
        isDragOver: false,
        isDragActive: false,
        isDragReject: false,
      });
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragState({
      isDragOver: false,
      isDragActive: false,
      isDragReject: false,
    });

    if (disabled) return;

    const files = e.dataTransfer.files;
    const { valid } = validateFiles(files);
    
    if (valid.length > 0) {
      onFilesSelected(valid);
    }
  }, [disabled, validateFiles, onFilesSelected]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || disabled) return;

    const { valid } = validateFiles(files);
    
    if (valid.length > 0) {
      onFilesSelected(valid);
    }

    // Reset input value to allow selecting the same file again
    e.target.value = '';
  }, [disabled, validateFiles, onFilesSelected]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card
      className={cn(
        'relative transition-all duration-200 cursor-pointer',
        {
          'border-dashed border-2': true,
          'border-primary bg-primary/5': dragState.isDragActive && !dragState.isDragReject,
          'border-destructive bg-destructive/5': dragState.isDragReject,
          'border-muted-foreground/25 hover:border-muted-foreground/50': !dragState.isDragActive && !disabled,
          'opacity-50 cursor-not-allowed': disabled,
        },
        className
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <CardContent className="flex flex-col items-center justify-center p-8 text-center">
        <div className={cn(
          'mb-4 rounded-full p-4 transition-colors',
          {
            'bg-primary/10 text-primary': dragState.isDragActive && !dragState.isDragReject,
            'bg-destructive/10 text-destructive': dragState.isDragReject,
            'bg-muted text-muted-foreground': !dragState.isDragActive,
          }
        )}>
          {dragState.isDragReject ? (
            <X className="h-8 w-8" />
          ) : (
            <Upload className="h-8 w-8" />
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">
            {dragState.isDragActive
              ? dragState.isDragReject
                ? 'Invalid files'
                : 'Drop files here'
              : 'Upload CSV files'
            }
          </h3>
          
          <p className="text-sm text-muted-foreground">
            {dragState.isDragReject
              ? 'Only CSV files under ' + formatFileSize(maxSizeBytes) + ' are allowed'
              : `Drag and drop CSV files here, or click to browse`
            }
          </p>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" />
            <span>CSV files only</span>
            <span>•</span>
            <span>Max {formatFileSize(maxSizeBytes)}</span>
            <span>•</span>
            <span>Up to {maxFiles} files</span>
          </div>
        </div>

        <Button
          variant="outline"
          className="mt-6"
          disabled={disabled}
          onClick={() => document.getElementById('file-upload-input')?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          Choose Files
        </Button>

        <input
          id="file-upload-input"
          type="file"
          accept=".csv,text/csv"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
          disabled={disabled}
        />
      </CardContent>
    </Card>
  );
};

export default FileUploadZone;