import React, { useState, useEffect } from 'react';
import { useBreadcrumb } from '../contexts/BreadcrumbContext';
import { SQLEditor, QueryResults, QueryHistory } from '../components/query';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { 
  History, 
  Database, 
  AlertCircle,
  X
} from 'lucide-react';
import { useTables } from '../hooks/api';
import { useQueryExecution } from '../hooks/useQueryExecution';

const QueryPage: React.FC = () => {
  const { clearBreadcrumbs } = useBreadcrumb();
  
  // State management
  const [currentQuery, setCurrentQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  
  // Fetch tables for auto-completion
  const { data: tables = [], isLoading: isLoadingTables } = useTables();
  
  // Query execution hook
  const {
    queryResult,
    isExecuting,
    executionError,
    queryHistory,
    favoriteQueries,
    isLoadingHistory,
    executeQuery,
    clearError,
    loadQueryHistory,
    saveQuery,
    toggleFavorite,
    deleteQuery,
    exportResults,
  } = useQueryExecution();
  
  // Clear breadcrumbs when component mounts
  useEffect(() => {
    clearBreadcrumbs();
  }, [clearBreadcrumbs]);

  // Load query history on mount
  useEffect(() => {
    loadQueryHistory();
  }, [loadQueryHistory]);

  // Prepare table and column data for auto-completion
  const availableTables = tables.map(table => table.name);
  const availableColumns = tables.reduce((acc, table) => {
    acc[table.name] = table.schema.map(col => col.name);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SQL Query Interface</h1>
          <p className="text-muted-foreground mt-1">
            Execute SQL queries against your data tables
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {!isLoadingTables && (
            <Badge variant="secondary" className="gap-1">
              <Database className="h-3 w-3" />
              {availableTables.length} tables available
            </Badge>
          )}
          
          <Button
            variant="outline"
            onClick={() => setShowHistory(!showHistory)}
            className="gap-2"
          >
            <History className="h-4 w-4" />
            {showHistory ? 'Hide History' : 'Show History'}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Query editor and results */}
        <div className={`space-y-6 ${showHistory ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          {/* SQL Editor */}
          <SQLEditor
            value={currentQuery}
            onChange={setCurrentQuery}
            onExecute={executeQuery}
            onSave={(sql) => saveQuery(sql, 'Untitled Query')}
            onShowHistory={() => setShowHistory(true)}
            isExecuting={isExecuting}
            availableTables={availableTables}
            availableColumns={availableColumns}
          />

          {/* Execution Error */}
          {executionError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{executionError}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearError}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Query Results */}
          <QueryResults
            result={queryResult}
            isLoading={isExecuting}
            error={executionError}
            onExport={exportResults}
          />
        </div>

        {/* Query History Sidebar */}
        {showHistory && (
          <div className="lg:col-span-1">
            <QueryHistory
              historyItems={queryHistory}
              favoriteQueries={favoriteQueries}
              onExecuteQuery={(sql) => {
                setCurrentQuery(sql);
                executeQuery(sql);
              }}
              onSaveQuery={saveQuery}
              onToggleFavorite={toggleFavorite}
              onDeleteQuery={deleteQuery}
              isLoading={isLoadingHistory}
            />
          </div>
        )}
      </div>

      {/* Quick actions for empty state */}
      {!currentQuery && !queryResult && availableTables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Start</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableTables.slice(0, 3).map((tableName) => (
                <Button
                  key={tableName}
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-start gap-2"
                  onClick={() => {
                    const sampleQuery = `SELECT * FROM ${tableName} LIMIT 10;`;
                    setCurrentQuery(sampleQuery);
                  }}
                >
                  <div className="font-medium">Query {tableName}</div>
                  <div className="text-xs text-muted-foreground text-left">
                    SELECT * FROM {tableName} LIMIT 10;
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default QueryPage;