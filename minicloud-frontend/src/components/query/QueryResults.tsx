import React, { useState, useMemo, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '../ui/pagination';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Download, 
  Search,
  Filter,
  Clock,
  Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QueryResult } from '@/types/api';

export interface QueryResultsProps {
  result: QueryResult | null;
  isLoading?: boolean;
  error?: string | null;
  onExport?: (format: 'csv' | 'json') => void;
  className?: string;
}

interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

interface FilterConfig {
  column: string;
  value: string;
}

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

const QueryResults: React.FC<QueryResultsProps> = ({
  result,
  isLoading = false,
  error = null,
  onExport,
  className
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter and sort data
  const processedData = useMemo(() => {
    if (!result?.rows || !result?.columns) return [];

    let filteredData = [...result.rows];

    // Apply search filter
    if (searchTerm) {
      filteredData = filteredData.filter(row =>
        row.some(cell => 
          String(cell).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply column filters
    filters.forEach(filter => {
      const columnIndex = result.columns.indexOf(filter.column);
      if (columnIndex !== -1) {
        filteredData = filteredData.filter(row =>
          String(row[columnIndex]).toLowerCase().includes(filter.value.toLowerCase())
        );
      }
    });

    // Apply sorting
    if (sortConfig && result.columns) {
      const columnIndex = result.columns.indexOf(sortConfig.column);
      if (columnIndex !== -1) {
        filteredData.sort((a, b) => {
          const aVal = a[columnIndex];
          const bVal = b[columnIndex];
          
          // Handle null/undefined values
          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return sortConfig.direction === 'asc' ? -1 : 1;
          if (bVal == null) return sortConfig.direction === 'asc' ? 1 : -1;
          
          // Convert to strings for comparison
          const aStr = String(aVal);
          const bStr = String(bVal);
          
          // Try numeric comparison first
          const aNum = Number(aStr);
          const bNum = Number(bStr);
          
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
          }
          
          // Fall back to string comparison
          const comparison = aStr.localeCompare(bStr);
          return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
      }
    }

    return filteredData;
  }, [result, searchTerm, filters, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentPageData = processedData.slice(startIndex, endIndex);

  // Reset pagination when data changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [result, searchTerm, filters, sortConfig, rowsPerPage]);

  // Handle sorting
  const handleSort = useCallback((column: string) => {
    setSortConfig(prev => {
      if (prev?.column === column) {
        if (prev.direction === 'asc') {
          return { column, direction: 'desc' };
        } else {
          return null; // Remove sorting
        }
      } else {
        return { column, direction: 'asc' };
      }
    });
  }, []);

  // Handle column filter
  const handleColumnFilter = useCallback((column: string, value: string) => {
    setFilters(prev => {
      const existing = prev.find(f => f.column === column);
      if (existing) {
        if (value === '') {
          return prev.filter(f => f.column !== column);
        } else {
          return prev.map(f => f.column === column ? { ...f, value } : f);
        }
      } else {
        return value === '' ? prev : [...prev, { column, value }];
      }
    });
  }, []);

  // Generate pagination items
  const generatePaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              isActive={currentPage === i}
              onClick={() => setCurrentPage(i)}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      // Always show first page
      items.push(
        <PaginationItem key={1}>
          <PaginationLink
            isActive={currentPage === 1}
            onClick={() => setCurrentPage(1)}
          >
            1
          </PaginationLink>
        </PaginationItem>
      );

      // Show ellipsis if needed
      if (currentPage > 3) {
        items.push(
          <PaginationItem key="ellipsis1">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              isActive={currentPage === i}
              onClick={() => setCurrentPage(i)}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }

      // Show ellipsis if needed
      if (currentPage < totalPages - 2) {
        items.push(
          <PaginationItem key="ellipsis2">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // Always show last page
      if (totalPages > 1) {
        items.push(
          <PaginationItem key={totalPages}>
            <PaginationLink
              isActive={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
            >
              {totalPages}
            </PaginationLink>
          </PaginationItem>
        );
      }
    }

    return items;
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Query Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-destructive">Query Error</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  // No results or invalid result structure
  if (!result || !result.columns) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Query Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            {!result ? "Execute a query to see results here" : "Invalid query result format"}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle>Query Results</CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Database className="h-4 w-4" />
                <span>{processedData.length} rows</span>
                {processedData.length !== result.rowsReturned && (
                  <span>(filtered from {result.rowsReturned})</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{result.executionTimeMs}ms</span>
              </div>
            </div>
          </div>
          
          {onExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onExport('csv')}>
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport('json')}>
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search and filters */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search in results..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          
          <Select value={String(rowsPerPage)} onValueChange={(value) => setRowsPerPage(Number(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROWS_PER_PAGE_OPTIONS.map(option => (
                <SelectItem key={option} value={String(option)}>
                  {option} rows
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Active filters */}
        {filters.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {filters.map(filter => (
              <Badge key={filter.column} variant="secondary" className="gap-1">
                <Filter className="h-3 w-3" />
                {filter.column}: {filter.value}
                <button
                  onClick={() => handleColumnFilter(filter.column, '')}
                  className="ml-1 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Results table */}
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                {result.columns.map((column) => (
                  <TableHead key={column} className="relative">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSort(column)}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        <span>{column}</span>
                        {sortConfig?.column === column ? (
                          sortConfig.direction === 'asc' ? (
                            <ArrowUp className="h-4 w-4" />
                          ) : (
                            <ArrowDown className="h-4 w-4" />
                          )
                        ) : (
                          <ArrowUpDown className="h-4 w-4 opacity-50" />
                        )}
                      </button>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentPageData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={result.columns?.length || 1} className="text-center py-8">
                    No results found
                  </TableCell>
                </TableRow>
              ) : (
                currentPageData.map((row, rowIndex) => (
                  <TableRow key={startIndex + rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <TableCell key={cellIndex} className="font-mono text-sm">
                        {cell === null || cell === undefined ? (
                          <span className="text-muted-foreground italic">null</span>
                        ) : (
                          String(cell)
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(endIndex, processedData.length)} of {processedData.length} results
            </div>
            
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className={cn(
                      currentPage === 1 && "pointer-events-none opacity-50"
                    )}
                  />
                </PaginationItem>
                
                {generatePaginationItems()}
                
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className={cn(
                      currentPage === totalPages && "pointer-events-none opacity-50"
                    )}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QueryResults;