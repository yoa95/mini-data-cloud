import { Badge } from '@/components/ui/Badge'
import { Separator } from '@/components/ui/Separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import {
  Database,
  Clock,
  Zap,
  CheckCircle,
  AlertCircle,
  Users,
  HardDrive,
  Activity,
} from 'lucide-react'

interface QueryStatusBarProps {
  isConnected: boolean
  activeWorkers: number
  totalWorkers: number
  queryCount: number
  lastExecutionTime?: number
  validationErrors?: number
  currentDatabase?: string
  memoryUsage?: string
}

export default function QueryStatusBar({
  isConnected,
  activeWorkers,
  totalWorkers,
  queryCount,
  lastExecutionTime,
  validationErrors = 0,
  currentDatabase = 'minicloud',
  memoryUsage = '0 MB',
}: QueryStatusBarProps) {
  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-t text-xs">
      {/* Left side - Connection and Database info */}
      <div className="flex items-center gap-4">
        {/* Connection Status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              {isConnected ? (
                <CheckCircle className="w-3 h-3 text-green-500" />
              ) : (
                <AlertCircle className="w-3 h-3 text-red-500" />
              )}
              <span className="font-medium">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isConnected
                ? 'Connected to Mini Data Cloud'
                : 'Connection to Mini Data Cloud lost'}
            </p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-4" />

        {/* Current Database */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              <Database className="w-3 h-3 text-muted-foreground" />
              <span>{currentDatabase}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Current database: {currentDatabase}</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-4" />

        {/* Worker Status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              <Users className="w-3 h-3 text-muted-foreground" />
              <span>
                {activeWorkers}/{totalWorkers} workers
              </span>
              {activeWorkers < totalWorkers && (
                <Badge variant="outline" className="text-xs px-1 py-0">
                  {totalWorkers - activeWorkers} offline
                </Badge>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {activeWorkers} of {totalWorkers} workers are active
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Right side - Performance and Stats */}
      <div className="flex items-center gap-4">
        {/* Memory Usage */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3 h-3 text-muted-foreground" />
              <span>{memoryUsage}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Current memory usage</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-4" />

        {/* Query Count */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-muted-foreground" />
              <span>{queryCount} queries</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Total queries executed this session</p>
          </TooltipContent>
        </Tooltip>

        {/* Last Execution Time */}
        {lastExecutionTime && (
          <>
            <Separator orientation="vertical" className="h-4" />
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span>{formatExecutionTime(lastExecutionTime)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Last query execution time</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}

        {/* Validation Errors */}
        {validationErrors > 0 && (
          <>
            <Separator orientation="vertical" className="h-4" />
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3 text-red-500" />
                  <Badge variant="destructive" className="text-xs px-1.5 py-0">
                    {validationErrors} errors
                  </Badge>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{validationErrors} validation errors in current query</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}

        {/* Performance Indicator */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-muted-foreground" />
              <Badge
                variant={
                  activeWorkers === totalWorkers
                    ? 'default'
                    : activeWorkers > 0
                      ? 'secondary'
                      : 'destructive'
                }
                className="text-xs px-1.5 py-0"
              >
                {activeWorkers === totalWorkers
                  ? 'Optimal'
                  : activeWorkers > 0
                    ? 'Degraded'
                    : 'Offline'}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              System performance:{' '}
              {activeWorkers === totalWorkers
                ? 'All workers active, optimal performance'
                : activeWorkers > 0
                  ? 'Some workers offline, degraded performance'
                  : 'No workers available'}
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
