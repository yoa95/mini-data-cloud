import React from 'react';
import { ArrowLeft, Database, Calendar, HardDrive, Users, FileText, Copy, ExternalLink, Download, Share } from 'lucide-react';
import { useTable } from '../../hooks/api';
import type { Column } from '../../types/api';
import SampleDataPreview from './SampleDataPreview';
import SchemaDialog from './SchemaDialog';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

interface TableDetailsProps {
  tableName: string;
  onBack?: () => void;
  onQueryTable?: (tableName: string) => void;
}

const TableDetails: React.FC<TableDetailsProps> = ({ 
  tableName, 
  onBack, 
  onQueryTable 
}) => {
  const { data: table, isLoading, error } = useTable(tableName);

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
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeIcon = (type: string): string => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('int') || lowerType.includes('number') || lowerType.includes('decimal')) {
      return '🔢';
    }
    if (lowerType.includes('string') || lowerType.includes('varchar') || lowerType.includes('text')) {
      return '📝';
    }
    if (lowerType.includes('date') || lowerType.includes('time')) {
      return '📅';
    }
    if (lowerType.includes('bool')) {
      return '✓';
    }
    return '📄';
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // In a real app, you'd show a toast notification here
      console.log('Copied to clipboard:', text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-16" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-6 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Schema skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Table Details</h1>
        </div>
        
        <Alert variant="destructive">
          <AlertDescription>
            Error loading table details: {error.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Table Details</h1>
        </div>
        
        <Alert>
          <AlertDescription>
            Table "{tableName}" not found.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6" />
              <h1 className="text-2xl font-bold">{table.name}</h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(table.name)}
                className="h-6 w-6 p-0"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            {table.namespace && (
              <Badge variant="secondary" className="mt-1">
                {table.namespace}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => onQueryTable?.(table.name)}
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Query Table
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const url = `${window.location.origin}/tables/${table.name}`;
              navigator.clipboard.writeText(url);
            }}
            className="flex items-center gap-2"
          >
            <Share className="h-4 w-4" />
            Share
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Rows
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {table.rowCount.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Columns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {table.schema.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              File Size
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatFileSize(table.fileSize)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Last Modified
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {formatDate(table.lastModified)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schema Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Schema
              </CardTitle>
              <CardDescription>
                Column definitions and data types
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <SchemaDialog
                tableName={table.name}
                schema={table.schema}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const schemaText = table.schema
                    .map(col => `${col.name}: ${col.type}${col.nullable ? ' (nullable)' : ''}`)
                    .join('\n');
                  copyToClipboard(schemaText);
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Schema
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <UITable>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Type</TableHead>
                <TableHead>Column Name</TableHead>
                <TableHead>Data Type</TableHead>
                <TableHead>Nullable</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.schema.map((column: Column, index: number) => (
                <TableRow key={`${column.name}-${index}`}>
                  <TableCell>
                    <span className="text-lg" title={column.type}>
                      {getTypeIcon(column.type)}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {column.name}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(column.name)}
                        className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {column.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={column.nullable ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {column.nullable ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {column.description || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </UITable>
        </CardContent>
      </Card>

      {/* Sample Data Preview */}
      <SampleDataPreview tableName={table.name} />

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common operations and queries for this table
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Query Templates</h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(`SELECT * FROM ${table.name} LIMIT 10;`)}
                >
                  Copy SELECT Query
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(`SELECT COUNT(*) FROM ${table.name};`)}
                >
                  Copy COUNT Query
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const columns = table.schema.map(col => col.name).join(', ');
                    copyToClipboard(`SELECT ${columns} FROM ${table.name};`);
                  }}
                >
                  Copy All Columns
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Data Export</h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const columns = table.schema.map(col => col.name).join(', ');
                    copyToClipboard(columns);
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Column Names
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // This would trigger a full table export in a real implementation
                    console.log('Export table:', table.name);
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Table
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TableDetails;