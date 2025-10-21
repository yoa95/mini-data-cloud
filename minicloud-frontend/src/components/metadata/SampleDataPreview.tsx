import React, { useState } from 'react';
import { RefreshCw, Download, Copy, Eye, EyeOff } from 'lucide-react';
import { useTableSample } from '../../hooks/api';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Alert, AlertDescription } from '../ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

interface SampleDataPreviewProps {
  tableName: string;
}

const SampleDataPreview: React.FC<SampleDataPreviewProps> = ({ tableName }) => {
  const [sampleSize, setSampleSize] = useState(10);
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: sampleData, isLoading, error, refetch } = useTableSample(tableName, sampleSize);

  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '—';
    }
    if (typeof value === 'string') {
      return value.length > 50 ? `${value.substring(0, 50)}...` : value;
    }
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    return String(value);
  };

  const copyTableData = () => {
    if (!sampleData) return;
    
    const csvContent = [
      sampleData.columns.join(','),
      ...sampleData.rows.map(row => 
        row.map(cell => {
          const value = String(cell || '');
          // Escape commas and quotes for CSV
          return value.includes(',') || value.includes('"') 
            ? `"${value.replace(/"/g, '""')}"` 
            : value;
        }).join(',')
      )
    ].join('\n');

    navigator.clipboard.writeText(csvContent).then(() => {
      console.log('Sample data copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy data:', err);
    });
  };

  const downloadSampleData = () => {
    if (!sampleData) return;

    const csvContent = [
      sampleData.columns.join(','),
      ...sampleData.rows.map(row => 
        row.map(cell => {
          const value = String(cell || '');
          return value.includes(',') || value.includes('"') 
            ? `"${value.replace(/"/g, '""')}"` 
            : value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tableName}_sample.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isExpanded) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Sample Data
              </CardTitle>
              <CardDescription>
                Preview the first few rows of data
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(true)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Show Preview
            </Button>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Sample Data
            </CardTitle>
            <CardDescription>
              {sampleData ? 
                `Showing ${sampleData.sampleSize} of ${sampleData.totalRows.toLocaleString()} rows` :
                'Preview the first few rows of data'
              }
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select 
              value={String(sampleSize)} 
              onValueChange={(value) => setSampleSize(Number(value))}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(false)}
            >
              <EyeOff className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-3">
            <div className="flex gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-4 flex-1" />
              ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-4 flex-1" />
                ))}
              </div>
            ))}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              Error loading sample data: {error.message}
            </AlertDescription>
          </Alert>
        )}

        {sampleData && (
          <div className="space-y-4">
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyTableData}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Data
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadSampleData}
              >
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-96">
                <UITable>
                  <TableHeader>
                    <TableRow>
                      {sampleData.columns.map((column, index) => (
                        <TableHead key={`header-${index}`} className="whitespace-nowrap">
                          {column}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sampleData.rows.map((row, rowIndex) => (
                      <TableRow key={`row-${rowIndex}`}>
                        {row.map((cell, cellIndex) => (
                          <TableCell 
                            key={`cell-${rowIndex}-${cellIndex}`}
                            className="whitespace-nowrap max-w-xs"
                          >
                            <span 
                              title={String(cell || '')}
                              className="block truncate"
                            >
                              {formatCellValue(cell)}
                            </span>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </UITable>
              </div>
            </div>

            {sampleData.sampleSize < sampleData.totalRows && (
              <p className="text-sm text-muted-foreground text-center">
                Showing {sampleData.sampleSize} of {sampleData.totalRows.toLocaleString()} total rows.
                Use the Query interface to explore more data.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SampleDataPreview;