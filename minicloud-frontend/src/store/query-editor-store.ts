import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Query editor types
export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  description?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  isFavorite: boolean;
}

export interface QueryTab {
  id: string;
  name: string;
  sql: string;
  isDirty: boolean;
  savedQueryId?: string;
  isExecuting: boolean;
  lastExecutionId?: string;
}

export interface QueryHistory {
  id: string;
  sql: string;
  executedAt: Date;
  executionTimeMs?: number;
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
  rowCount?: number;
  errorMessage?: string;
}

// Query editor state interface
interface QueryEditorState {
  // Current editor state
  currentSql: string;
  cursorPosition: { line: number; column: number };
  selectedText: string;
  
  // Tabs management
  tabs: QueryTab[];
  activeTabId: string;
  
  // Saved queries
  savedQueries: SavedQuery[];
  
  // Query history (local execution history)
  queryHistory: QueryHistory[];
  maxHistorySize: number;
  
  // Editor preferences
  editorSettings: {
    theme: 'light' | 'dark' | 'high-contrast';
    fontSize: number;
    tabSize: number;
    wordWrap: boolean;
    showLineNumbers: boolean;
    showMinimap: boolean;
    enableAutoCompletion: boolean;
    enableLinting: boolean;
    enableFormatting: boolean;
  };
  
  // Actions
  setCurrentSql: (sql: string) => void;
  setCursorPosition: (position: { line: number; column: number }) => void;
  setSelectedText: (text: string) => void;
  
  // Tab management
  createTab: (name?: string, sql?: string) => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<QueryTab>) => void;
  duplicateTab: (tabId: string) => string;
  renameTab: (tabId: string, name: string) => void;
  
  // Saved queries
  saveQuery: (query: Omit<SavedQuery, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateSavedQuery: (id: string, updates: Partial<SavedQuery>) => void;
  deleteSavedQuery: (id: string) => void;
  toggleFavorite: (id: string) => void;
  loadQueryIntoTab: (queryId: string, tabId?: string) => void;
  
  // Query history
  addToHistory: (history: Omit<QueryHistory, 'id'>) => void;
  clearHistory: () => void;
  removeFromHistory: (id: string) => void;
  
  // Editor settings
  updateEditorSettings: (settings: Partial<QueryEditorState['editorSettings']>) => void;
  
  // Utility actions
  formatCurrentQuery: () => void;
  clearCurrentQuery: () => void;
  insertTextAtCursor: (text: string) => void;
}

// Default editor settings
const defaultEditorSettings = {
  theme: 'light' as const,
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  showLineNumbers: true,
  showMinimap: false,
  enableAutoCompletion: true,
  enableLinting: true,
  enableFormatting: true,
};

// Generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Create the query editor store
export const useQueryEditorStore = create<QueryEditorState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      currentSql: '',
      cursorPosition: { line: 1, column: 1 },
      selectedText: '',
      
      tabs: [{
        id: 'default',
        name: 'Query 1',
        sql: '',
        isDirty: false,
        isExecuting: false,
      }],
      activeTabId: 'default',
      
      savedQueries: [],
      queryHistory: [],
      maxHistorySize: 100,
      
      editorSettings: defaultEditorSettings,

      // Basic editor actions
      setCurrentSql: (sql) => set((state) => {
        state.currentSql = sql;
        // Mark active tab as dirty if SQL changed
        const activeTab = state.tabs.find(t => t.id === state.activeTabId);
        if (activeTab && activeTab.sql !== sql) {
          activeTab.sql = sql;
          activeTab.isDirty = true;
        }
      }),
      
      setCursorPosition: (position) => set((state) => {
        state.cursorPosition = position;
      }),
      
      setSelectedText: (text) => set((state) => {
        state.selectedText = text;
      }),

      // Tab management
      createTab: (name, sql = '') => {
        const id = generateId();
        const tabName = name || `Query ${get().tabs.length + 1}`;
        
        set((state) => {
          state.tabs.push({
            id,
            name: tabName,
            sql,
            isDirty: false,
            isExecuting: false,
          });
          state.activeTabId = id;
          state.currentSql = sql;
        });
        
        return id;
      },
      
      closeTab: (tabId) => set((state) => {
        const tabIndex = state.tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1 || state.tabs.length === 1) return;
        
        state.tabs.splice(tabIndex, 1);
        
        // If closing active tab, switch to another tab
        if (state.activeTabId === tabId) {
          const newActiveIndex = Math.min(tabIndex, state.tabs.length - 1);
          state.activeTabId = state.tabs[newActiveIndex].id;
          state.currentSql = state.tabs[newActiveIndex].sql;
        }
      }),
      
      setActiveTab: (tabId) => set((state) => {
        const tab = state.tabs.find(t => t.id === tabId);
        if (tab) {
          state.activeTabId = tabId;
          state.currentSql = tab.sql;
        }
      }),
      
      updateTab: (tabId, updates) => set((state) => {
        const tab = state.tabs.find(t => t.id === tabId);
        if (tab) {
          Object.assign(tab, updates);
        }
      }),
      
      duplicateTab: (tabId) => {
        const tab = get().tabs.find(t => t.id === tabId);
        if (tab) {
          return get().createTab(`${tab.name} (Copy)`, tab.sql);
        }
        return '';
      },
      
      renameTab: (tabId, name) => set((state) => {
        const tab = state.tabs.find(t => t.id === tabId);
        if (tab) {
          tab.name = name;
        }
      }),

      // Saved queries
      saveQuery: (query) => {
        const id = generateId();
        const now = new Date();
        const savedQuery: SavedQuery = {
          id,
          createdAt: now,
          updatedAt: now,
          isFavorite: false,
          ...query,
        };
        
        set((state) => {
          state.savedQueries.push(savedQuery);
        });
        
        return id;
      },
      
      updateSavedQuery: (id, updates) => set((state) => {
        const query = state.savedQueries.find(q => q.id === id);
        if (query) {
          Object.assign(query, updates, { updatedAt: new Date() });
        }
      }),
      
      deleteSavedQuery: (id) => set((state) => {
        state.savedQueries = state.savedQueries.filter(q => q.id !== id);
      }),
      
      toggleFavorite: (id) => set((state) => {
        const query = state.savedQueries.find(q => q.id === id);
        if (query) {
          query.isFavorite = !query.isFavorite;
          query.updatedAt = new Date();
        }
      }),
      
      loadQueryIntoTab: (queryId, tabId) => {
        const query = get().savedQueries.find(q => q.id === queryId);
        if (!query) return;
        
        const targetTabId = tabId || get().activeTabId;
        
        set((state) => {
          const tab = state.tabs.find(t => t.id === targetTabId);
          if (tab) {
            tab.sql = query.sql;
            tab.savedQueryId = queryId;
            tab.isDirty = false;
            if (targetTabId === state.activeTabId) {
              state.currentSql = query.sql;
            }
          }
        });
      },

      // Query history
      addToHistory: (history) => set((state) => {
        const id = generateId();
        const newHistory: QueryHistory = { id, ...history };
        
        state.queryHistory.unshift(newHistory);
        
        // Limit history size
        if (state.queryHistory.length > state.maxHistorySize) {
          state.queryHistory = state.queryHistory.slice(0, state.maxHistorySize);
        }
      }),
      
      clearHistory: () => set((state) => {
        state.queryHistory = [];
      }),
      
      removeFromHistory: (id) => set((state) => {
        state.queryHistory = state.queryHistory.filter(h => h.id !== id);
      }),

      // Editor settings
      updateEditorSettings: (settings) => set((state) => {
        Object.assign(state.editorSettings, settings);
      }),

      // Utility actions
      formatCurrentQuery: () => {
        // This would integrate with a SQL formatter
        // For now, just basic formatting
        const { currentSql } = get();
        if (currentSql.trim()) {
          const formatted = currentSql
            .replace(/\s+/g, ' ')
            .replace(/,\s*/g, ',\n  ')
            .replace(/\bSELECT\b/gi, 'SELECT')
            .replace(/\bFROM\b/gi, '\nFROM')
            .replace(/\bWHERE\b/gi, '\nWHERE')
            .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
            .replace(/\bORDER BY\b/gi, '\nORDER BY')
            .trim();
          
          get().setCurrentSql(formatted);
        }
      },
      
      clearCurrentQuery: () => {
        get().setCurrentSql('');
      },
      
      insertTextAtCursor: (text) => {
        const { currentSql, cursorPosition } = get();
        const lines = currentSql.split('\n');
        const line = lines[cursorPosition.line - 1] || '';
        const before = line.substring(0, cursorPosition.column - 1);
        const after = line.substring(cursorPosition.column - 1);
        
        lines[cursorPosition.line - 1] = before + text + after;
        get().setCurrentSql(lines.join('\n'));
      },
    })),
    {
      name: 'minicloud-query-editor-store',
      storage: createJSONStorage(() => localStorage),
      // Persist everything except current editor state
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        savedQueries: state.savedQueries,
        queryHistory: state.queryHistory,
        editorSettings: state.editorSettings,
      }),
      version: 1,
    }
  )
);

// Selectors
export const useCurrentTab = () => useQueryEditorStore((state) => 
  state.tabs.find(t => t.id === state.activeTabId)
);

export const useSavedQueries = () => useQueryEditorStore((state) => state.savedQueries);

export const useFavoriteQueries = () => useQueryEditorStore((state) => 
  state.savedQueries.filter(q => q.isFavorite)
);

export const useQueryHistory = () => useQueryEditorStore((state) => state.queryHistory);

export const useEditorSettings = () => useQueryEditorStore((state) => state.editorSettings);

export const useTabsInfo = () => useQueryEditorStore((state) => ({
  tabs: state.tabs,
  activeTabId: state.activeTabId,
  hasUnsavedChanges: state.tabs.some(t => t.isDirty),
}));