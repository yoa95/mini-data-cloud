import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Theme types
export type Theme = 'light' | 'dark' | 'system';
export type ColorScheme = 'light' | 'dark';

// UI preferences interface
interface UIPreferences {
  theme: Theme;
  sidebarOpen: boolean;
  sidebarWidth: number;
  compactMode: boolean;
  showLineNumbers: boolean;
  fontSize: number;
  autoSave: boolean;
  showMinimap: boolean;
  wordWrap: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
}

// UI state interface
interface UIState {
  // Theme and preferences
  preferences: UIPreferences;
  resolvedColorScheme: ColorScheme;
  
  // Layout state
  activeTab: string;
  breadcrumbs: Array<{ label: string; href?: string }>;
  
  // Modal and dialog state
  modals: Record<string, boolean>;
  
  // Loading states
  globalLoading: boolean;
  loadingMessage: string | undefined;
  
  // Actions
  setTheme: (theme: Theme) => void;
  setResolvedColorScheme: (scheme: ColorScheme) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setCompactMode: (compact: boolean) => void;
  setShowLineNumbers: (show: boolean) => void;
  setFontSize: (size: number) => void;
  setAutoSave: (autoSave: boolean) => void;
  setShowMinimap: (show: boolean) => void;
  setWordWrap: (wrap: boolean) => void;
  setHighContrast: (highContrast: boolean) => void;
  setReducedMotion: (reducedMotion: boolean) => void;
  
  setActiveTab: (tab: string) => void;
  setBreadcrumbs: (breadcrumbs: Array<{ label: string; href?: string }>) => void;
  
  openModal: (modalId: string) => void;
  closeModal: (modalId: string) => void;
  toggleModal: (modalId: string) => void;
  
  setGlobalLoading: (loading: boolean, message?: string) => void;
  
  // Reset functions
  resetPreferences: () => void;
  resetUIState: () => void;
}

// Default preferences
const defaultPreferences: UIPreferences = {
  theme: 'system',
  sidebarOpen: true,
  sidebarWidth: 280,
  compactMode: false,
  showLineNumbers: true,
  fontSize: 14,
  autoSave: true,
  showMinimap: false,
  wordWrap: true,
  highContrast: false,
  reducedMotion: false,
};

// Create the UI store with persistence
export const useUIStore = create<UIState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      preferences: defaultPreferences,
      resolvedColorScheme: 'light',
      activeTab: 'query',
      breadcrumbs: [],
      modals: {},
      globalLoading: false,
      loadingMessage: undefined,

      // Theme actions
      setTheme: (theme) => set((state) => {
        state.preferences.theme = theme;
      }),
      
      setResolvedColorScheme: (scheme) => set((state) => {
        state.resolvedColorScheme = scheme;
      }),

      // Sidebar actions
      toggleSidebar: () => set((state) => {
        state.preferences.sidebarOpen = !state.preferences.sidebarOpen;
      }),
      
      setSidebarOpen: (open) => set((state) => {
        state.preferences.sidebarOpen = open;
      }),
      
      setSidebarWidth: (width) => set((state) => {
        state.preferences.sidebarWidth = Math.max(200, Math.min(400, width));
      }),

      // Preference actions
      setCompactMode: (compact) => set((state) => {
        state.preferences.compactMode = compact;
      }),
      
      setShowLineNumbers: (show) => set((state) => {
        state.preferences.showLineNumbers = show;
      }),
      
      setFontSize: (size) => set((state) => {
        state.preferences.fontSize = Math.max(10, Math.min(24, size));
      }),
      
      setAutoSave: (autoSave) => set((state) => {
        state.preferences.autoSave = autoSave;
      }),
      
      setShowMinimap: (show) => set((state) => {
        state.preferences.showMinimap = show;
      }),
      
      setWordWrap: (wrap) => set((state) => {
        state.preferences.wordWrap = wrap;
      }),
      
      setHighContrast: (highContrast) => set((state) => {
        state.preferences.highContrast = highContrast;
      }),
      
      setReducedMotion: (reducedMotion) => set((state) => {
        state.preferences.reducedMotion = reducedMotion;
      }),

      // Navigation actions
      setActiveTab: (tab) => set((state) => {
        state.activeTab = tab;
      }),
      
      setBreadcrumbs: (breadcrumbs) => set((state) => {
        state.breadcrumbs = breadcrumbs;
      }),

      // Modal actions
      openModal: (modalId) => set((state) => {
        state.modals[modalId] = true;
      }),
      
      closeModal: (modalId) => set((state) => {
        state.modals[modalId] = false;
      }),
      
      toggleModal: (modalId) => set((state) => {
        state.modals[modalId] = !state.modals[modalId];
      }),

      // Loading actions
      setGlobalLoading: (loading, message) => set((state) => {
        state.globalLoading = loading;
        state.loadingMessage = message;
      }),

      // Reset actions
      resetPreferences: () => set((state) => {
        state.preferences = { ...defaultPreferences };
      }),
      
      resetUIState: () => set((state) => {
        state.activeTab = 'query';
        state.breadcrumbs = [];
        state.modals = {};
        state.globalLoading = false;
        state.loadingMessage = undefined;
      }),
    })),
    {
      name: 'minicloud-ui-store',
      storage: createJSONStorage(() => localStorage),
      // Only persist preferences, not transient UI state
      partialize: (state) => ({
        preferences: state.preferences,
      }),
      version: 1,
      migrate: (persistedState: any, version: number) => {
        // Handle migration between versions if needed
        if (version === 0) {
          // Migrate from version 0 to 1
          return {
            preferences: {
              ...defaultPreferences,
              ...persistedState.preferences,
            },
          };
        }
        return persistedState;
      },
    }
  )
);

// Selectors for common use cases
export const useTheme = () => useUIStore((state) => state.preferences.theme);
export const useResolvedColorScheme = () => useUIStore((state) => state.resolvedColorScheme);
export const useSidebarOpen = () => useUIStore((state) => state.preferences.sidebarOpen);
export const useSidebarWidth = () => useUIStore((state) => state.preferences.sidebarWidth);
export const useCompactMode = () => useUIStore((state) => state.preferences.compactMode);
export const useActiveTab = () => useUIStore((state) => state.activeTab);
export const useBreadcrumbs = () => useUIStore((state) => state.breadcrumbs);
// Individual selectors to avoid object creation
export const useGlobalLoading = () => useUIStore((state) => state.globalLoading);
export const useLoadingMessage = () => useUIStore((state) => state.loadingMessage);

// Modal selectors - return individual values to avoid object creation
export const useModalOpen = (modalId: string) => useUIStore((state) => !!state.modals[modalId]);
export const useModalActions = () => useUIStore((state) => ({
  openModal: state.openModal,
  closeModal: state.closeModal,
  toggleModal: state.toggleModal,
}));

// Accessibility selectors - individual selectors
export const useHighContrast = () => useUIStore((state) => state.preferences.highContrast);
export const useReducedMotion = () => useUIStore((state) => state.preferences.reducedMotion);
export const useFontSize = () => useUIStore((state) => state.preferences.fontSize);