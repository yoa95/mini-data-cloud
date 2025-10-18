import React, { useState, useMemo } from 'react';
import { Search, Filter, Database, Calendar, HardDrive, Users } from 'lucide-react';
import { useTables } from '../../hooks/api';
import type { Table } from '../../types/api';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Alert, AlertDescription } from '../ui/alert';

interface TableListProps {
  onTableSelect?: (table: Table) => void;
}

type SortOption = 'name' | 'rowCount' | 'fileSize' | 'lastModified';
type SortDirection = 'asc' | 'desc';

const TableList: React.FC<TableListProps> = ({ onTableSelect }) => {
  const { data: tables, isLoading, error } = useTables();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showEmptyTables, setShowEmptyTables] = useState(true);

  // Debounced search - in a real app, you'd use a proper debounce hook
  const [debouncedSearch, setDebouncedSearch] = useState('');
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredAndSortedTables = useMemo(() => {
    if (!tables) return [];

    const filtered = tables.filter((table) => {
      const matchesSearch = table.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ?? false;
      const matchesEmptyFilter = showEmptyTables || table.rowCount > 0;
      return matchesSearch && matchesEmptyFilter;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'rowCount':
          comparison = a.rowCount - b.rowCount;
          break;
        case 'fileSize':
          comparison = a.fileSize - b.fileSize;
          break;
        case 'lastModified':
          comparison = new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime();
          break;
      }

      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [tables, debouncedSearch, sortBy, sortDirection, showEmptyTables]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4 items-center">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Error loading tables: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!tables || tables.length === 0) {
    return (
      <div className="text-center py-12">
        <Database className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No tables found</h3>
        <p className="text-muted-foreground mb-4">
          Get started by uploading your first CSV file to create a table.
        </p>
        <Button onClick={() => window.location.href = '/upload'}>
          Upload Data
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="rowCount">Row Count</SelectItem>
              <SelectItem value="fileSize">File Size</SelectItem>
              <SelectItem value="lastModified">Last Modified</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
          >
            {sortDirection === 'asc' ? '↑' : '↓'}
          </Button>
        </div>
      </div>

      {/* Filter Options */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="show-empty"
          checked={showEmptyTables}
          onCheckedChange={(checked) => setShowEmptyTables(checked as boolean)}
        />
        <label
          htmlFor="show-empty"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Show empty tables
        </label>
        <Filter className="h-4 w-4 text-muted-foreground ml-2" />
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredAndSortedTables.length} of {tables.length} tables
        </p>
      </div>

      {/* Table Grid */}
      {filteredAndSortedTables.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No tables match your search criteria.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedTables.map((table) => (
            <Card 
              key={table.name} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onTableSelect?.(table)}
            >
              <CardHeader className="pb-3">
                <div className="space-y-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Database className="h-4 w-4" />
                    {table.name}
                  </CardTitle>
                  {table.namespace && (
                    <Badge variant="secondary" className="text-xs">
                      {table.namespace}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{table.rowCount.toLocaleString()} rows</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span>{formatFileSize(table.fileSize)}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDate(table.lastModified)}</span>
                </div>
                
                <div className="pt-2">
                  <Badge variant="outline" className="text-xs">
                    {table.schema?.length || 0} columns
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TableList;