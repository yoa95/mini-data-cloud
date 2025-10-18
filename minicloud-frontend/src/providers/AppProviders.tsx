// Modern provider setup with React Query and Auth
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthContext, useAuthState } from '../lib/auth';
import { httpClient } from '../lib/http-client';
import { createAuthInterceptor } from '../lib/auth';

// Create a stable query client instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors except 401
        if (error instanceof Error && error.message.includes('HTTP_4')) {
          return error.message.includes('HTTP_401') ? failureCount < 1 : false;
        }
        return failureCount < 3;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

interface AuthProviderProps {
  children: React.ReactNode;
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const authState = useAuthState();

  // Set up auth interceptor
  React.useEffect(() => {
    const removeInterceptor = httpClient.addRequestInterceptor(
      createAuthInterceptor(authState.getToken)
    );

    // Add response interceptor for auth errors
    const removeResponseInterceptor = httpClient.addResponseInterceptor(
      async (response) => {
        if (response.status === 401) {
          authState.clearToken();
          // Optionally redirect to login or show auth modal
        }
        return response;
      }
    );

    return () => {
      removeInterceptor();
      removeResponseInterceptor();
    };
  }, [authState]);

  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  );
};

interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        {import.meta.env.DEV && <ReactQueryDevtools />}
      </AuthProvider>
    </QueryClientProvider>
  );
};