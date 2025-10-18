import { useState, useCallback } from 'react';
import { apiClient } from '../lib/api-client';
import type { QueryResult, QueryHistoryItem } from '../types/api';

export interface UseQueryExecutionReturn {
  // State
  queryResult: QueryResult | null;
  isExecuting: boolean;
  executionError: string | null;
  queryHistory: QueryHistoryItem[];
  favoriteQueries: QueryHistoryItem[];
  isLoadingHistory: boolean;

  // Actions
  executeQuery: (sql: string) => Promise<void>;
  clearResult: () => void;
  clearError: () => void;
  loadQueryHistory: () => Promise<void>;
  saveQuery: (sql: string, name: string) => Promise<void>;
  toggleFavorite: (queryId: string) => void;
  deleteQuery: (queryId: string) => void;
  exportResults: (format: 'csv' | 'json') => void;
}

export const useQueryExecution = (): UseQueryExecutionReturn => {
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);
  const [favoriteQueries, setFavoriteQueries] = useState<QueryHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Load query history from API
  const loadQueryHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      const history = await apiClient.getQueryHistory();
      setQueryHistory(history);
      
      // Load favorites from localStorage (in a real app, this might come from the API)
      const savedFavorites = localStorage.getItem('minicloud_favorite_queries');
      if (savedFavorites) {
        const favoriteIds = JSON.parse(savedFavorites);
        const favorites = history.filter(item => favoriteIds.includes(item.id));
        setFavoriteQueries(favorites);
      }
    } catch (error) {
      console.error('Failed to load query history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Execute query
  const executeQuery = useCallback(async (sql: string) => {
    if (!sql.trim()) return;

    setIsExecuting(true);
    setExecutionError(null);
    setQueryResult(null);

    try {
      const result = await apiClient.executeQuery({ sql });
      setQueryResult(result);
      
      // Refresh query history to include the new query
      await loadQueryHistory();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setExecutionError(errorMessage);
    } finally {
      setIsExecuting(false);
    }
  }, [loadQueryHistory]);

  // Clear result
  const clearResult = useCallback(() => {
    setQueryResult(null);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setExecutionError(null);
  }, []);

  // Save query (placeholder - in a real app this would save to backend)
  const saveQuery = useCallback(async (sql: string, name: string) => {
    try {
      // In a real implementation, this would save to the backend
      console.log('Saving query:', { sql, name });
      
      // For now, just add to local storage as a favorite
      const newQuery: QueryHistoryItem = {
        id: Date.now().toString(),
        sql,
        executedAt: new Date(),
        executionTime: 0,
        status: 'success'
      };
      
      const updatedFavorites = [...favoriteQueries, newQuery];
      setFavoriteQueries(updatedFavorites);
      
      // Save favorite IDs to localStorage
      const favoriteIds = updatedFavorites.map(fav => fav.id);
      localStorage.setItem('minicloud_favorite_queries', JSON.stringify(favoriteIds));
    } catch (error) {
      console.error('Failed to save query:', error);
    }
  }, [favoriteQueries]);

  // Toggle favorite status
  const toggleFavorite = useCallback((queryId: string) => {
    const isFavorite = favoriteQueries.some(fav => fav.id === queryId);
    
    if (isFavorite) {
      // Remove from favorites
      const updatedFavorites = favoriteQueries.filter(fav => fav.id !== queryId);
      setFavoriteQueries(updatedFavorites);
      
      const favoriteIds = updatedFavorites.map(fav => fav.id);
      localStorage.setItem('minicloud_favorite_queries', JSON.stringify(favoriteIds));
    } else {
      // Add to favorites
      const queryToFavorite = queryHistory.find(item => item.id === queryId);
      if (queryToFavorite) {
        const updatedFavorites = [...favoriteQueries, queryToFavorite];
        setFavoriteQueries(updatedFavorites);
        
        const favoriteIds = updatedFavorites.map(fav => fav.id);
        localStorage.setItem('minicloud_favorite_queries', JSON.stringify(favoriteIds));
      }
    }
  }, [queryHistory, favoriteQueries]);

  // Delete query from history (placeholder)
  const deleteQuery = useCallback((queryId: string) => {
    // In a real implementation, this would delete from the backend
    setQueryHistory(prev => prev.filter(item => item.id !== queryId));
    setFavoriteQueries(prev => prev.filter(item => item.id !== queryId));
  }, []);

  // Export query results
  const exportResults = useCallback((format: 'csv' | 'json') => {
    if (!queryResult) return;

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'csv') {
      // Convert to CSV
      const headers = queryResult.columns.join(',');
      const rows = queryResult.rows.map(row => 
        row.map(cell => {
          const cellStr = String(cell ?? '');
          // Escape quotes and wrap in quotes if contains comma or quote
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(',')
      );
      content = [headers, ...rows].join('\n');
      filename = `query_results_${Date.now()}.csv`;
      mimeType = 'text/csv';
    } else {
      // Convert to JSON
      const jsonData = queryResult.rows.map(row => {
        const obj: Record<string, unknown> = {};
        queryResult.columns.forEach((col, index) => {
          obj[col] = row[index];
        });
        return obj;
      });
      content = JSON.stringify(jsonData, null, 2);
      filename = `query_results_${Date.now()}.json`;
      mimeType = 'application/json';
    }

    // Create and trigger download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [queryResult]);

  return {
    // State
    queryResult,
    isExecuting,
    executionError,
    queryHistory,
    favoriteQueries,
    isLoadingHistory,

    // Actions
    executeQuery,
    clearResult,
    clearError,
    loadQueryHistory,
    saveQuery,
    toggleFavorite,
    deleteQuery,
    exportResults,
  };
};