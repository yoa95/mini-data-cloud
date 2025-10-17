import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import type { ListChildComponentProps } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { 
  Search,
  SortAsc,
  SortDesc,
  Filter,
  Download,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QueryResult } from '@/types/api';

interface InfiniteQueryResultsTableProps {
  results: QueryResult;
  className?: string;
  maxHeight?: number;
  pageSize?: number;
  onLoadMore?: (startIndex: number, stopIndex: number) => Promise<any[]>;
  hasNextPage?: boolean;
  isLoadingMore?: boolean;
}

interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

interface FilterConfig {
  column: string;
  value: string;
}

const HEADER_HEIGHT = 40;
const ROW_HEIGHT = 35;
const DEFAULT_PAGE_SIZE = 100;

export const InfiniteQueryResultsTable: React.FC<InfiniteQueryResultsTableProps> = ({
  results,
  className,
  maxHeight = 600,
  pageSize = DEFAULT_PAGE_SIZE,
  onLoadMore,
  hasNextPage = false,
  isLoadingMore = false,
}) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [allRows, setAllRows] = useState<Array<Record<string, any>>>(results.rows);

  // Update rows when results change
  useEffect(() => {
    setAllRows(results.rows);
  }, [results.rows]);

  // Process data with sorting and filtering
  const processedData = useMemo(() => {
    let data = [...allRows];

    // Apply filters
    if (filters.length > 0) {
      data = data.filter(row => {
        return filters.every(filter => {
          const value = row[filter.column];
          const filterValue = filter.value.toLowerCase();
          return String(value || '').toLowerCase().includes(filterValue);
        });
      });
    }

    // Apply global search
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      data = data.filter(row => {
        return results.columns.some(col => {
          const value = row[col.name];
          return String(value || '').toLowerCase().includes(searchLower);
        });
      });
    }

    // Apply sorting
    if (sortConfig) {
      data.sort((a, b) => {
        const aVal = a[sortConfig.column];
        const bVal = b[sortConfig.column];
        
        // Handle null/undefined values
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortConfig.direction === 'asc' ? -1 : 1;
        if (bVal == null) return sortConfig.direction === 'asc' ? 1 : -1;
        
        // Compare values
        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }
        
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }

    return data;
  }, [allRows, results.columns, sortConfig, filters, searchTerm]);

  // Infinite loading logic
  const itemCount = hasNextPage ? processedData.length + 1 : processedData.length;
  const isItemLoaded = (index: number) => !!processedData[index];

  const loadMoreItems = useCallback(async (startIndex: number, stopIndex: number) => {
    if (onLoadMore && !isLoadingMore) {
      try {
        const newRows = await onLoadMore(startIndex, stopIndex);
        setAllRows(prev => [...prev, ...newRows]);
      } catch (error) {
        console.error('Failed to load more items:', error);
      }
    }
  }, [onLoadMore, isLoadingMore]);

  // Handle sorting
  const handleSort = useCallback((columnName: string) => {
    setSortConfig(prev => {
      if (prev?.column === columnName) {
        // Toggle direction or clear sort
        if (prev.direction === 'asc') {
          return { column: columnName, direction: 'desc' };
        } else {
          return null; // Clear sort
        }
      } else {
        return { column: columnName, direction: 'asc' };
      }
    });
  }, []);

  // Handle column filter
  const handleColumnFilter = useCallback((columnName: string, value: string) => {
    setFilters(prev => {
      const existing = prev.find(f => f.column === columnName);
      if (existing) {
        if (value === '') {
          // Remove filter
          return prev.filter(f => f.column !== columnName);
        } else {
          // Update filter
          return prev.map(f => 
            f.column === columnName ? { ...f, value } : f
          );
        }
      } else if (value !== '') {
        // Add new filter
        return [...prev, { column: columnName, value }];
      }
      return prev;
    });
  }, []);

  // Export functionality
  const handleExport = useCallback((format: 'csv' | 'json') => {
    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'csv') {
      // Generate CSV
      const headers = results.columns.map(col => col.name).join(',');
      const rows = processedData.map(row => 
        results.columns.map(col => {
          const value = row[col.name];
          // Escape CSV values
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value ?? '';
        }).join(',')
      );
      content = [headers, ...rows].join('\n');
      filename = `query_results_${Date.now()}.csv`;
      mimeType = 'text/csv';
    } else {
      // Generate JSON
      content = JSON.stringify({
        columns: results.columns,
        rows: processedData,
        totalRows: processedData.length,
        exportedAt: new Date().toISOString(),
      }, null, 2);
      filename = `query_results_${Date.now()}.json`;
      mimeType = 'application/json';
    }

    // Download file
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [results.columns, processedData]);

  // Format cell value
  const formatCellValue = (value: any, columnType: string) => {
    if (value == null) return <span className="text-muted-foreground italic">null</span>;
    
    if (columnType.toLowerCase().includes('date') || columnType.toLowerCase().includes('timestamp')) {
      try {
        return new Date(value).toLocaleString();
      } catch {
        return String(value);
      }
    }
    
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    
    if (typeof value === 'boolean') {
      return (
        <Badge variant={value ? 'success' : 'secondary'}>
          {value ? 'true' : 'false'}
        </Badge>
      );
    }
    
    return String(value);
  };

  // Get sort icon
  const getSortIcon = (columnName: string) => {
    if (sortConfig?.column !== columnName) return null;
    return sortConfig.direction === 'asc' ? (
      <SortAsc className="w-4 h-4" />
    ) : (
      <SortDesc className="w-4 h-4" />
    );
  };

  // Row renderer for virtualization
  const Row = ({ index, style }: ListChildComponentProps) => {
    const row = processedData[index];
    
    // Loading row
    if (!row) {
      return (
        <div
          style={style}
          className="flex items-center justify-center border-b border-border bg-muted/30"
        >
          <LoadingSpinner className="w-4 h-4" />
          <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
        </div>
      );
    }

    return (
      <div
        style={style}
        className={cn(
          'flex border-b border-border',
          index % 2 === 0 ? 'bg-background' : 'bg-muted/30'
        )}
      >
        {results.columns.map((column) => (
          <div
            key={column.name}
            className="flex-1 px-3 py-2 text-sm truncate min-w-0"
            style={{ minWidth: '120px' }}
            title={String(row[column.name] || '')}
          >
            {formatCellValue(row[column.name], column.type)}
          </div>
        ))}
      </div>
    );
  };

  if (!results || results.rows.length === 0) {
    return (
      <Card className={cn('p-8 text-center', className)}>
        <p className="text-muted-foreground">No results to display</p>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Search and Controls */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search all columns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
            {filters.length > 0 && (
              <Badge variant="outline" className="gap-1">
                <Filter className="w-3 h-3" />
                {filters.length} filter{filters.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={() => handleExport('csv')}
              variant="outline"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button
              onClick={() => handleExport('json')}
              variant="outline"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              JSON
            </Button>
            {onLoadMore && (
              <Button
                onClick={() => loadMoreItems(processedData.length, processedData.length + pageSize)}
                variant="outline"
                size="sm"
                disabled={isLoadingMore || !hasNextPage}
              >
                <RefreshCw className={cn('w-4 h-4 mr-2', isLoadingMore && 'animate-spin')} />
                Load More
              </Button>
            )}
          </div>
        </div>
        
        <div className="text-sm text-muted-foreground">
          Showing {processedData.length.toLocaleString()} rows
          {processedData.length !== results.totalRows && (
            <span> (filtered from {results.totalRows.toLocaleString()})</span>
          )}
          {hasNextPage && <span> • More available</span>}
        </div>
      </div>

      {/* Table Header */}
      <div className="flex bg-muted/50 border-b border-border" style={{ height: HEADER_HEIGHT }}>
        {results.columns.map((column) => (
          <div
            key={column.name}
            className="flex-1 px-3 py-2 font-medium text-sm border-r border-border last:border-r-0 min-w-0"
            style={{ minWidth: '120px' }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="truncate">
                <div className="font-medium">{column.name}</div>
                <div className="text-xs text-muted-foreground font-normal">
                  {column.type}
                </div>
              </div>
              
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => handleSort(column.name)}
                >
                  {getSortIcon(column.name) || <SortAsc className="w-4 h-4 opacity-50" />}
                </Button>
              </div>
            </div>
            
            {/* Column Filter */}
            <Input
              placeholder="Filter..."
              className="mt-1 h-6 text-xs"
              value={filters.find(f => f.column === column.name)?.value || ''}
              onChange={(e) => handleColumnFilter(column.name, e.target.value)}
            />
          </div>
        ))}
      </div>

      {/* Virtualized Table Body with Infinite Loading */}
      <div style={{ height: Math.min(maxHeight - HEADER_HEIGHT - 120, itemCount * ROW_HEIGHT) }}>
        <InfiniteLoader
          isItemLoaded={isItemLoaded}
          itemCount={itemCount}
          loadMoreItems={loadMoreItems}
        >
          {({ onItemsRendered, ref }) => (
            <List
              ref={ref}
              height={Math.min(maxHeight - HEADER_HEIGHT - 120, itemCount * ROW_HEIGHT)}
              itemCount={itemCount}
              itemSize={ROW_HEIGHT}
              onItemsRendered={onItemsRendered}
              width="100%"
            >
              {Row}
            </List>
          )}
        </InfiniteLoader>
      </div>
    </Card>
  );
};

export default InfiniteQueryResultsTable;