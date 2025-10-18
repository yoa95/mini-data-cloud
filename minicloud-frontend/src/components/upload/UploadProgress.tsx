import React, { useState } from "react";
import { X, CheckCircle, AlertCircle, FileText, Loader2 } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { Alert, AlertDescription } from "../ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { cn } from "@/lib/utils";
import type { UploadStatus } from "../../types/api";

export interface UploadProgressProps {
  uploads: UploadStatus[];
  onCancelUpload: (fileName: string) => void;
  onRetryUpload: (fileName: string) => void;
  onClearCompleted: () => void;
  className?: string;
}

interface CancelDialogState {
  isOpen: boolean;
  fileName: string;
}

const UploadProgress: React.FC<UploadProgressProps> = ({
  uploads,
  onCancelUpload,
  onRetryUpload,
  onClearCompleted,
  className,
}) => {
  const [cancelDialog, setCancelDialog] = useState<CancelDialogState>({
    isOpen: false,
    fileName: "",
  });

  const getStatusIcon = (status: UploadStatus["status"]) => {
    switch (status) {
      case "pending":
        return <FileText className="h-4 w-4 text-muted-foreground" />;
      case "uploading":
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (upload: UploadStatus): string => {
    switch (upload.status) {
      case "pending":
        return "Waiting to upload...";
      case "uploading":
        return `Uploading... ${upload.progress}%`;
      case "processing":
        return "Processing file...";
      case "completed":
        return upload.tableCreated
          ? `Completed - Table: ${upload.tableCreated}`
          : "Upload completed";
      case "error":
        return upload.error || "Upload failed";
      default:
        return "Unknown status";
    }
  };

  const handleCancelClick = (fileName: string) => {
    setCancelDialog({ isOpen: true, fileName });
  };

  const handleConfirmCancel = () => {
    if (cancelDialog.fileName) {
      onCancelUpload(cancelDialog.fileName);
    }
    setCancelDialog({ isOpen: false, fileName: "" });
  };

  const handleCancelDialogClose = () => {
    setCancelDialog({ isOpen: false, fileName: "" });
  };

  const activeUploads = uploads.filter(
    (u) =>
      u.status === "uploading" ||
      u.status === "processing" ||
      u.status === "pending"
  );
  const completedUploads = uploads.filter((u) => u.status === "completed");
  const failedUploads = uploads.filter((u) => u.status === "error");

  if (uploads.length === 0) {
    return null;
  }

  return (
    <>
      <Card className={cn("w-full", className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              Upload Progress ({uploads.length} files)
            </h3>
            {completedUploads.length > 0 && (
              <Button variant="outline" size="sm" onClick={onClearCompleted}>
                Clear Completed
              </Button>
            )}
          </div>

          {/* Summary alerts */}
          {completedUploads.length > 0 && (
            <Alert variant="success" className="mb-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {completedUploads.length} file
                {completedUploads.length > 1 ? "s" : ""} uploaded successfully
              </AlertDescription>
            </Alert>
          )}

          {failedUploads.length > 0 && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {failedUploads.length} file{failedUploads.length > 1 ? "s" : ""}{" "}
                failed to upload
              </AlertDescription>
            </Alert>
          )}

          {/* Upload items */}
          <div className="space-y-3">
            {uploads.map((upload) => (
              <div
                key={upload.id}
                className={cn("flex items-center gap-3 p-3 rounded-lg border", {
                  "bg-green-50 border-green-200": upload.status === "completed",
                  "bg-red-50 border-red-200": upload.status === "error",
                  "bg-blue-50 border-blue-200":
                    upload.status === "uploading" ||
                    upload.status === "processing",
                  "bg-gray-50 border-gray-200": upload.status === "pending",
                })}
              >
                {/* Status icon */}
                <div className="flex-shrink-0">
                  {getStatusIcon(upload.status)}
                </div>

                {/* File info and progress */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium truncate">
                      {upload.fileName}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {upload.status === "uploading" && `${upload.progress}%`}
                    </span>
                  </div>

                  {/* Progress bar for active uploads */}
                  {(upload.status === "uploading" ||
                    upload.status === "processing") && (
                    <Progress
                      value={
                        upload.status === "processing" ? 100 : upload.progress
                      }
                      className="h-2 mb-1"
                    />
                  )}

                  <p className="text-xs text-muted-foreground">
                    {getStatusText(upload)}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex-shrink-0 flex gap-1">
                  {(upload.status === "uploading" ||
                    upload.status === "pending") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelClick(upload.fileName)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Cancel upload</span>
                    </Button>
                  )}

                  {upload.status === "error" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRetryUpload(upload.fileName)}
                      className="h-8 px-2 text-xs"
                    >
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Overall progress summary */}
          {activeUploads.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>Overall Progress</span>
                <span>
                  {uploads.filter((u) => u.status === "completed").length} of{" "}
                  {uploads.length} completed
                </span>
              </div>
              <Progress
                value={
                  (uploads.filter((u) => u.status === "completed").length /
                    uploads.length) *
                  100
                }
                className="h-2"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel confirmation dialog */}
      <Dialog open={cancelDialog.isOpen} onOpenChange={handleCancelDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Upload</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel the upload of "
              {cancelDialog.fileName}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelDialogClose}>
              Keep Uploading
            </Button>
            <Button variant="destructive" onClick={handleConfirmCancel}>
              Cancel Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UploadProgress;
