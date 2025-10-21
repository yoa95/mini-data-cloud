// Modern auth management with React hooks and context
import { createContext, useContext, useCallback, useMemo } from 'react';

const AUTH_TOKEN_KEY = 'minicloud_auth_token';

export interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
}

export interface AuthActions {
  setToken: (token: string) => void;
  clearToken: () => void;
  getToken: () => string | null;
}

// Safe localStorage access (SSR-friendly)
const storage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Handle storage errors gracefully
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch {
      // Handle storage errors gracefully
    }
  },
};

export const AuthContext = createContext<(AuthState & AuthActions) | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Hook for auth state management
export const useAuthState = (initialToken?: string) => {
  const token = initialToken || storage.getItem(AUTH_TOKEN_KEY);
  
  const setToken = useCallback((newToken: string) => {
    storage.setItem(AUTH_TOKEN_KEY, newToken);
  }, []);

  const clearToken = useCallback(() => {
    storage.removeItem(AUTH_TOKEN_KEY);
  }, []);

  const getToken = useCallback(() => {
    return storage.getItem(AUTH_TOKEN_KEY);
  }, []);

  const authState = useMemo((): AuthState & AuthActions => ({
    token,
    isAuthenticated: Boolean(token),
    setToken,
    clearToken,
    getToken,
  }), [token, setToken, clearToken, getToken]);

  return authState;
};

// Auth interceptor for HTTP client
export const createAuthInterceptor = (getToken: () => string | null) => {
  return (config: RequestInit) => {
    const token = getToken();
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    return config;
  };
};