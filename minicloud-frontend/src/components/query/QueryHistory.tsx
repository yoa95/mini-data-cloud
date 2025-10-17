import React, { useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { 
  History, 
  Search, 
  Play, 
  Star, 
  StarOff, 
  Trash2, 
  Clock,
  Database,
  Filter,
  SortAsc,
  SortDesc,
} from 'lucide-react';
import { useRecentQueries } from '@/hooks/api/queries';
import { useQueryEditorStore, useQueryHistory } from '@/store/query-editor-store';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import type { QueryResponse } from '@/types/api';

interface QueryHistoryProps {
  onSelectQuery?: (sql: string) => void;
  onExecuteQuery?: (sql: string) => void;
  className?: string;
  maxItems?: number;
}

type SortField = 'executedAt' | 'executionTime' | 'status' | 'rowCount';
type SortDirection = 'asc' | 'desc';

export const QueryHistory: React.FC<QueryHistoryProps> = ({
  onSelectQuery,
  onExecuteQuery,
  className,
  maxItems = 50,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('executedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  const { toast } = useToast();
  
  // Get recent queries from API
  const { data: recentQueries = [], isLoading, refetch } = useRecentQueries(maxItems);
  
  // Get local query history from store
  const localHistory = useQueryHistory();
  const { addToHistory, removeFromHistory, clearHistory } = useQueryEditorStore();

  // Combine and deduplicate queries
  const allQueries = React.useMemo(() => {
    const combined = [...recentQueries, ...localHistory];
    const seen = new Set();
    return combined.filter(query => {
      const key = `${query.sql}-${query.executedAt || query.submittedAt}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [recentQueries, localHistory]);

  // Filter and sort queries
  const filteredQueries = React.useMemo(() => {
    let filtered = allQueries;

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(query => 
        query.sql?.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(query => query.status === statusFilter);
    }

    // Sort queries
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortField) {
        case 'executedAt':
          aVal = new Date(a.executedAt || a.submittedAt || 0).getTime();
          bVal = new Date(b.executedAt || b.submittedAt || 0).getTime();
          break;
        case 'executionTime':
          aVal = a.executionTimeMs || 0;
          bVal = b.executionTimeMs || 0;
          break;
        case 'status':
          aVal = a.status || '';
          bVal = b.status || '';
          break;
        case 'rowCount':
          aVal = a.rowsReturned || a.rowCount || 0;
          bVal = b.rowsReturned || b.rowCount || 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [allQueries, searchTerm, statusFilter, sortField, sortDirection]);

  // Handle sort
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField]);

  // Handle query selection
  const handleSelectQuery = useCallback((query: QueryResponse | any) => {
    onSelectQuery?.(query.sql);
    toast({
      title: 'Query Loaded',
      description: 'Query has been loaded into the editor.',
      variant: 'success',
    });
  }, [onSelectQuery, toast]);

  // Handle query execution
  const handleExecuteQuery = useCallback((query: QueryResponse | any) => {
    onExecuteQuery?.(query.sql);
    toast({
      title: 'Query Executing',
      description: 'Query has been submitted for execution.',
      variant: 'info',
    });
  }, [onExecuteQuery, toast]);

  // Handle delete query from local history
  const handleDeleteQuery = useCallback((queryId: string) => {
    removeFromHistory(queryId);
    toast({
      title: 'Query Removed',
      description: 'Query has been removed from history.',
      variant: 'success',
    });
  }, [removeFromHistory, toast]);

  // Handle clear all history
  const handleClearHistory = useCallback(() => {
    clearHistory();
    toast({
      title: 'History Cleared',
      description: 'All query history has been cleared.',
      variant: 'success',
    });
  }, [clearHistory, toast]);

  // Format execution time
  const formatExecutionTime = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Format date
  const formatDate = (date: string | Date) => {
    try {
      return new Date(date).toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  // Get status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'COMPLETED':
      case 'SUCCESS':
        return 'success';
      case 'FAILED':
        return 'destructive';
      case 'CANCELLED':
        return 'secondary';
      case 'RUNNING':
      case 'SUBMITTED':
        return 'default';
      default:
        return 'outline';
    }
  };

  // Get sort icon
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <SortAsc className="w-4 h-4 opacity-50" />;
    return sortDirection === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />;
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5" />
            <h3 className="font-semibold">Query History</h3>
            <Badge variant="outline">{filteredQueries.length}</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              Refresh
            </Button>
            
            <Button
              onClick={handleClearHistory}
              variant="outline"
              size="sm"
              disabled={localHistory.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search queries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1 border border-border rounded-md text-sm bg-background"
            >
              <option value="all">All Status</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
              <option value="RUNNING">Running</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Query List */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-4" />
            <p className="text-muted-foreground">Loading query history...</p>
          </div>
        ) : filteredQueries.length === 0 ? (
          <div className="p-8 text-center">
            <History className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {searchTerm || statusFilter !== 'all' 
                ? 'No queries match your filters' 
                : 'No query history available'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Sort Header */}
            <div className="px-4 py-2 bg-muted/50 text-sm font-medium grid grid-cols-12 gap-4">
              <div className="col-span-6">Query</div>
              <div 
                className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-primary"
                onClick={() => handleSort('executedAt')}
              >
                Executed
                {getSortIcon('executedAt')}
              </div>
              <div 
                className="col-span-1 flex items-center gap-1 cursor-pointer hover:text-primary"
                onClick={() => handleSort('status')}
              >
                Status
                {getSortIcon('status')}
              </div>
              <div 
                className="col-span-1 flex items-center gap-1 cursor-pointer hover:text-primary"
                onClick={() => handleSort('executionTime')}
              >
                Time
                {getSortIcon('executionTime')}
              </div>
              <div 
                className="col-span-1 flex items-center gap-1 cursor-pointer hover:text-primary"
                onClick={() => handleSort('rowCount')}
              >
                Rows
                {getSortIcon('rowCount')}
              </div>
              <div className="col-span-1">Actions</div>
            </div>

            {filteredQueries.map((query, index) => (
              <div key={`${query.queryId || query.id || index}`} className="px-4 py-3 hover:bg-muted/30 grid grid-cols-12 gap-4 items-center">
                <div className="col-span-6">
                  <div className="font-mono text-sm truncate" title={query.sql}>
                    {query.sql}
                  </div>
                </div>
                
                <div className="col-span-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(query.executedAt || query.submittedAt || '')}
                  </div>
                </div>
                
                <div className="col-span-1">
                  <Badge variant={getStatusVariant(query.status || '')}>
                    {query.status || 'Unknown'}
                  </Badge>
                </div>
                
                <div className="col-span-1 text-sm text-muted-foreground">
                  {formatExecutionTime(query.executionTimeMs)}
                </div>
                
                <div className="col-span-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    {(query.rowsReturned || query.rowCount || 0).toLocaleString()}
                  </div>
                </div>
                
                <div className="col-span-1">
                  <div className="flex items-center gap-1">
                    <Button
                      onClick={() => handleSelectQuery(query)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      title="Load query"
                    >
                      <Play className="w-3 h-3" />
                    </Button>
                    
                    {query.id && (
                      <Button
                        onClick={() => handleDeleteQuery(query.id)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        title="Remove from history"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

export default QueryHistory;