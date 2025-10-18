// Core data types for Mini Data Cloud API

export interface Table {
  name: string;
  schema: Column[];
  rowCount: number;
  fileSize: number;
  lastModified: Date;
  namespace?: string;
}

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
}

export interface QueryResult {
  queryId: string;
  status: string;
  submittedAt: string;
  startedAt?: string;
  completedAt?: string;
  executionTimeMs: number;
  rowsReturned: number;
  errorMessage?: string;
  resultLocation: string;
  columns: string[];
  rows: unknown[][];
  resultDescription?: string;
}

export interface QueryRequest {
  sql: string;
  queryId?: string;
}

export interface UploadStatus {
  fileName: string;
  progress: number;
  status: "pending" | "uploading" | "processing" | "completed" | "error";
  error?: string;
  tableCreated?: string;
}

export interface UploadResult {
  success: boolean;
  tableName?: string;
  message?: string;
  error?: string;
}

export interface ClusterMetrics {
  workers: WorkerStatus[];
  activeQueries: number;
  totalQueries: number;
  systemLoad: number;
  memoryUsage: number;
}

export interface WorkerStatus {
  id: string;
  status: "healthy" | "unhealthy" | "offline";
  cpuUsage: number;
  memoryUsage: number;
  lastHeartbeat: Date;
}

export interface QueryHistoryItem {
  id: string;
  sql: string;
  executedAt: Date;
  executionTime: number;
  status: "success" | "error";
  error?: string;
}

export interface TableInfo {
  name: string;
  rowCount: number;
  fileSize: number;
  lastModified: Date;
}

export interface SampleData {
  columns: string[];
  rows: unknown[][];
  totalRows: number;
  sampleSize: number;
}

// Backend response types (what the API actually returns)
export interface BackendTableResponse {
  namespaceName: string;
  tableName: string;
  tableLocation: string;
  tableFormat: string;
  rowCount: number;
  dataSizeBytes: number;
  createdAt: string;
  updatedAt: string;
  fullTableName: string;
}

// API Response wrapper types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Error types
export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export class MiniCloudApiError extends Error {
  public code?: string;
  public details?: unknown;

  constructor(message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "MiniCloudApiError";
    this.code = code;
    this.details = details;
  }
}
