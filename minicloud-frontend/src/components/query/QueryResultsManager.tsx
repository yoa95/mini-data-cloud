import React, { useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { 
  Table, 
  BarChart3, 
  Download, 
  Share, 
  Maximize2,
  Settings,
} from 'lucide-react';
import QueryResultsTable from './QueryResultsTable';
import InfiniteQueryResultsTable from './InfiniteQueryResultsTable';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import type { QueryResult } from '@/types/api';

interface QueryResultsManagerProps {
  results: QueryResult;
  queryId?: string;
  className?: string;
  enableInfiniteScroll?: boolean;
  onLoadMore?: (startIndex: number, stopIndex: number) => Promise<any[]>;
  hasNextPage?: boolean;
  isLoadingMore?: boolean;
}

export const QueryResultsManager: React.FC<QueryResultsManagerProps> = ({
  results,
  queryId,
  className,
  enableInfiniteScroll = false,
  onLoadMore,
  hasNextPage = false,
  isLoadingMore = false,
}) => {
  const [activeView, setActiveView] = useState<'table' | 'chart'>('table');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { toast } = useToast();

  // Share results
  const handleShare = useCallback(() => {
    if (!queryId) {
      toast({
        title: 'Cannot Share',
        description: 'No query ID available for sharing.',
        variant: 'error',
      });
      return;
    }

    const shareUrl = `${window.location.origin}/query/${queryId}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Query Results',
        text: `Check out these query results with ${results.totalRows.toLocaleString()} rows`,
        url: shareUrl,
      }).catch(() => {
        // Fallback to clipboard
        copyToClipboard(shareUrl);
      });
    } else {
      copyToClipboard(shareUrl);
    }
  }, [queryId, results.totalRows, toast]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: 'Link Copied',
        description: 'Share link has been copied to clipboard.',
        variant: 'success',
      });
    }).catch(() => {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy link to clipboard.',
        variant: 'error',
      });
    });
  };

  // Export all results
  const handleExportAll = useCallback((format: 'csv' | 'json') => {
    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'csv') {
      // Generate CSV
      const headers = results.columns.map(col => col.name).join(',');
      const rows = results.rows.map(row => 
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
      filename = `query_results_${queryId || Date.now()}.csv`;
      mimeType = 'text/csv';
    } else {
      // Generate JSON
      content = JSON.stringify({
        queryId,
        executionTime: results.executionTime,
        totalRows: results.totalRows,
        bytesScanned: results.bytesScanned,
        columns: results.columns,
        rows: results.rows,
        exportedAt: new Date().toISOString(),
      }, null, 2);
      filename = `query_results_${queryId || Date.now()}.json`;
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

    toast({
      title: 'Export Complete',
      description: `Results exported as ${format.toUpperCase()}.`,
      variant: 'success',
    });
  }, [results, queryId, toast]);

  // Generate basic statistics
  const generateStats = useCallback(() => {
    const stats = {
      totalRows: results.totalRows,
      totalColumns: results.columns.length,
      numericColumns: results.columns.filter(col => 
        col.type.toLowerCase().includes('int') || 
        col.type.toLowerCase().includes('float') || 
        col.type.toLowerCase().includes('double') ||
        col.type.toLowerCase().includes('decimal')
      ).length,
      textColumns: results.columns.filter(col => 
        col.type.toLowerCase().includes('string') || 
        col.type.toLowerCase().includes('varchar') ||
        col.type.toLowerCase().includes('text')
      ).length,
      dateColumns: results.columns.filter(col => 
        col.type.toLowerCase().includes('date') || 
        col.type.toLowerCase().includes('timestamp')
      ).length,
    };

    return stats;
  }, [results]);

  const stats = generateStats();

  return (
    <Card className={cn('overflow-hidden', isFullscreen && 'fixed inset-4 z-50', className)}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Query Results</h3>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span>{results.totalRows.toLocaleString()} rows</span>
              <span>{results.columns.length} columns</span>
              <span>Executed in {results.executionTime}ms</span>
              <span>{(results.bytesScanned / 1024 / 1024).toFixed(2)} MB scanned</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => handleExportAll('csv')}
              variant="outline"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            
            <Button
              onClick={() => handleExportAll('json')}
              variant="outline"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              JSON
            </Button>
            
            {queryId && (
              <Button
                onClick={handleShare}
                variant="outline"
                size="sm"
              >
                <Share className="w-4 h-4 mr-2" />
                Share
              </Button>
            )}
            
            <Button
              onClick={() => setIsFullscreen(!isFullscreen)}
              variant="outline"
              size="sm"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{stats.totalRows.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Total Rows</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{stats.totalColumns}</div>
            <div className="text-xs text-muted-foreground">Columns</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.numericColumns}</div>
            <div className="text-xs text-muted-foreground">Numeric</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.textColumns}</div>
            <div className="text-xs text-muted-foreground">Text</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.dateColumns}</div>
            <div className="text-xs text-muted-foreground">Date/Time</div>
          </div>
        </div>
      </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={(value) => setActiveView(value as any)}>
        <div className="px-4 pt-4">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="table" className="flex items-center gap-2">
              <Table className="w-4 h-4" />
              Table View
            </TabsTrigger>
            <TabsTrigger value="chart" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Chart View
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="table" className="mt-0">
          {enableInfiniteScroll && onLoadMore ? (
            <InfiniteQueryResultsTable
              results={results}
              onLoadMore={onLoadMore}
              hasNextPage={hasNextPage}
              isLoadingMore={isLoadingMore}
              maxHeight={isFullscreen ? window.innerHeight - 200 : 600}
            />
          ) : (
            <QueryResultsTable
              results={results}
              maxHeight={isFullscreen ? window.innerHeight - 200 : 600}
            />
          )}
        </TabsContent>

        <TabsContent value="chart" className="mt-0">
          <Card className="p-8 text-center">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h4 className="font-medium mb-2">Chart Visualization</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Interactive charts and visualizations will be available here.
            </p>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Configure Charts
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsFullscreen(false)}
        />
      )}
    </Card>
  );
};

export default QueryResultsManager;