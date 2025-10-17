import React, { useMemo, useState, useCallback } from 'react';
// @ts-ignore
import { FixedSizeList as List } from 'react-window';
import type { ListChildComponentProps } from 'react-window';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  Search,
  SortAsc,
  SortDesc,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QueryResult } from '@/types/api';

interface QueryResultsTableProps {
  results: QueryResult;
  className?: string;
  maxHeight?: number;
  pageSize?: number;
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

export const QueryResultsTable: React.FC<QueryResultsTableProps> = ({
  results,
  className,
  maxHeight = 600,
  pageSize = DEFAULT_PAGE_SIZE,
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Process data with sorting and filtering
  const processedData = useMemo(() => {
    let data = [...results.rows];

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
  }, [results.rows, results.columns, sortConfig, filters, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize);
  const startIndex = currentPage * pageSize;
  const endIndex = Math.min(startIndex + pageSize, processedData.length);
  const currentPageData = processedData.slice(startIndex, endIndex);

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

  // Pagination handlers
  const goToFirstPage = () => setCurrentPage(0);
  const goToPreviousPage = () => setCurrentPage(prev => Math.max(0, prev - 1));
  const goToNextPage = () => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
  const goToLastPage = () => setCurrentPage(totalPages - 1);

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
    const row = currentPageData[index];
    if (!row) return null;

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
        <div className="flex items-center justify-between gap-4">
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
          
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1}-{endIndex} of {processedData.length} rows
            {processedData.length !== results.totalRows && (
              <span> (filtered from {results.totalRows.toLocaleString()})</span>
            )}
          </div>
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

      {/* Virtualized Table Body */}
      <div style={{ height: Math.min(maxHeight - HEADER_HEIGHT - 120, currentPageData.length * ROW_HEIGHT) }}>
        <List
          height={Math.min(maxHeight - HEADER_HEIGHT - 120, currentPageData.length * ROW_HEIGHT)}
          itemCount={currentPageData.length}
          itemSize={ROW_HEIGHT}
          width="100%"
        >
          {Row}
        </List>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            Page {currentPage + 1} of {totalPages}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToFirstPage}
              disabled={currentPage === 0}
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousPage}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <span className="px-3 py-1 text-sm">
              {currentPage + 1}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={currentPage >= totalPages - 1}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToLastPage}
              disabled={currentPage >= totalPages - 1}
            >
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default QueryResultsTable;