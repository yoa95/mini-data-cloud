// API Types based on backend DTOs

export interface QueryRequest {
  sql: string;
  sessionId?: string;
}

export interface QueryResponse {
  queryId: string;
  status: QueryStatus;
  submittedAt: string;
  startedAt?: string;
  completedAt?: string;
  executionTimeMs?: number;
  rowsReturned?: number;
  errorMessage?: string;
  resultLocation?: string;
  columns?: string[];
  rows?: string[][];
  resultDescription?: string;
}

export type QueryStatus = 
  | 'SUBMITTED' 
  | 'RUNNING' 
  | 'COMPLETED' 
  | 'FAILED' 
  | 'CANCELLED';

export interface QueryResult {
  columns: Array<{
    name: string;
    type: string;
  }>;
  rows: Array<Record<string, any>>;
  totalRows: number;
  executionTime: number;
  bytesScanned: number;
}

export interface QueryValidationResult {
  isValid: boolean;
  errors: DiagnosticError[];
  warnings: DiagnosticWarning[];
  suggestions: OptimizationSuggestion[];
  estimatedCost?: QueryCost;
}

export interface DiagnosticError {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
  quickFixes?: QuickFix[];
}

export interface DiagnosticWarning {
  line: number;
  column: number;
  message: string;
  code: string;
}

export interface OptimizationSuggestion {
  type: 'performance' | 'syntax' | 'best-practice';
  message: string;
  suggestion: string;
}

export interface QuickFix {
  title: string;
  description: string;
  edits: TextEdit[];
}

export interface TextEdit {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  newText: string;
}

export interface QueryCost {
  estimatedDuration: number;
  estimatedBytes: number;
  estimatedCost: number;
  complexity: 'low' | 'medium' | 'high';
}

export interface SupportCheckResult {
  supported: boolean;
  reason: string;
}

export interface QueryStats {
  totalQueries: number;
  runningQueries: number;
  completedQueries: number;
  failedQueries: number;
  avgExecutionTimeMs: number;
}

// Table/Metadata Types
export interface TableInfo {
  namespaceName: string;
  tableName: string;
  tableLocation: string;
  tableFormat?: string;
  rowCount?: number;
  dataSizeBytes?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RegisterTableRequest {
  tableLocation: string;
  schemaDefinition: string;
}

export interface UpdateStatsRequest {
  rowCount: number;
  dataSizeBytes: number;
}

export interface RegistryStats {
  totalTables: number;
  totalNamespaces: number;
  totalDataSizeBytes: number;
  totalRows: number;
}

// Worker Types
export interface WorkerInfo {
  workerId: string;
  endpoint: string;
  status: WorkerStatus;
  resources: ResourceInfo;
  lastHeartbeatMs: number;
}

export type WorkerStatus = 
  | 'HEALTHY' 
  | 'UNHEALTHY' 
  | 'DRAINING' 
  | 'STARTING';

export interface ResourceInfo {
  cpuCores: number;
  memoryMb: number;
  diskMb: number;
  activeQueries: number;
  cpuUtilization: number;
  memoryUtilization: number;
}

export interface ClusterStats {
  totalWorkers: number;
  healthyWorkers: number;
  unhealthyWorkers: number;
  drainingWorkers: number;
}

// System Health Types
export interface SystemHealth {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  uptime: number;
  version: string;
  memoryUsage: {
    used: number;
    total: number;
    max: number;
  };
}

// Data Loading Types
export interface UploadResult {
  tableName: string;
  rowCount: number;
  fileSizeBytes: number;
  durationMs: number;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
}

export interface InferredSchema {
  columns: InferredColumn[];
  sampleRows: Array<Record<string, any>>;
  hasHeader: boolean;
  delimiter: string;
}

export interface InferredColumn {
  name: string;
  inferredType: string;
  confidence: number;
  sampleValues: any[];
}

export interface TableSchema {
  tableName: string;
  namespaceName: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
  }>;
  hasHeader: boolean;
}

// API Error Types
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface UserFriendlyError {
  title: string;
  message: string;
  actions: string[];
}