import { 
  createBrowserRouter, 
  Navigate, 
  type RouteObject,
  type LoaderFunction,
} from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { 
  QueryErrorBoundary,
  MonitorErrorBoundary,
  MetadataErrorBoundary,
  UploadErrorBoundary,
  ConfigErrorBoundary
} from '@/components/ui/FeatureErrorBoundary';
import { queryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';

// Lazy load feature components for code splitting
import { lazy, Suspense } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// Lazy loaded components
const QueryInterface = lazy(() => import('@/features/query/QueryInterface'));
const SystemMonitor = lazy(() => import('@/features/monitor/SystemMonitor'));
const MetadataExplorer = lazy(() => import('@/features/metadata/MetadataExplorer'));
const DataUpload = lazy(() => import('@/features/upload/DataUpload'));
const Configuration = lazy(() => import('@/features/config/Configuration'));

// Error pages
const NotFound = lazy(() => import('@/components/pages/NotFound'));
const ErrorPage = lazy(() => import('@/components/pages/ErrorPage'));

// Route loaders for data prefetching
const queryLoader: LoaderFunction = async ({ params }) => {
  const queryId = params['queryId'];
  if (queryId) {
    // Prefetch query data
    await queryClient.prefetchQuery({
      queryKey: queryKeys.query(queryId),
      queryFn: () => import('@/lib/api-client').then(({ apiClient }) => 
        apiClient.getQueryStatus(queryId)
      ),
    });
  }
  return null;
};

const metadataLoader: LoaderFunction = async ({ params }) => {
  const { namespace, table } = params;
  
  // Prefetch tables list
  queryClient.prefetchQuery({
    queryKey: queryKeys.allTables(),
    queryFn: () => import('@/lib/api-client').then(({ apiClient }) => 
      apiClient.listAllTables()
    ),
  });
  
  // Prefetch specific table if provided
  if (namespace && table) {
    queryClient.prefetchQuery({
      queryKey: queryKeys.table(namespace, table),
      queryFn: () => import('@/lib/api-client').then(({ apiClient }) => 
        apiClient.getTable(namespace, table)
      ),
    });
  }
  
  return null;
};

const monitorLoader: LoaderFunction = async () => {
  // Prefetch monitoring data
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.clusterStats(),
      queryFn: () => import('@/lib/api-client').then(({ apiClient }) => 
        apiClient.getClusterStats()
      ),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.allWorkers(),
      queryFn: () => import('@/lib/api-client').then(({ apiClient }) => 
        apiClient.getWorkers()
      ),
    }),
  ]);
  
  return null;
};

// Wrapper component for lazy loaded routes with suspense
const LazyRouteWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<LoadingSpinner />}>
    {children}
  </Suspense>
);

// Route definitions with enhanced features
const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    errorElement: <LazyRouteWrapper><ErrorPage /></LazyRouteWrapper>,
    children: [
      {
        index: true,
        element: <Navigate to="/query" replace />,
      },
      {
        path: 'query',
        element: (
          <QueryErrorBoundary>
            <LazyRouteWrapper><QueryInterface /></LazyRouteWrapper>
          </QueryErrorBoundary>
        ),
        children: [
          {
            path: ':queryId',
            element: (
              <QueryErrorBoundary>
                <LazyRouteWrapper><QueryInterface /></LazyRouteWrapper>
              </QueryErrorBoundary>
            ),
            loader: queryLoader,
          },
        ],
      },
      {
        path: 'monitor',
        element: (
          <MonitorErrorBoundary>
            <LazyRouteWrapper><SystemMonitor /></LazyRouteWrapper>
          </MonitorErrorBoundary>
        ),
        loader: monitorLoader,
        children: [
          {
            path: 'workers',
            element: (
              <MonitorErrorBoundary>
                <LazyRouteWrapper><SystemMonitor /></LazyRouteWrapper>
              </MonitorErrorBoundary>
            ),
          },
          {
            path: 'workers/:workerId',
            element: (
              <MonitorErrorBoundary>
                <LazyRouteWrapper><SystemMonitor /></LazyRouteWrapper>
              </MonitorErrorBoundary>
            ),
          },
          {
            path: 'cluster',
            element: (
              <MonitorErrorBoundary>
                <LazyRouteWrapper><SystemMonitor /></LazyRouteWrapper>
              </MonitorErrorBoundary>
            ),
          },
        ],
      },
      {
        path: 'metadata',
        element: (
          <MetadataErrorBoundary>
            <LazyRouteWrapper><MetadataExplorer /></LazyRouteWrapper>
          </MetadataErrorBoundary>
        ),
        loader: metadataLoader,
        children: [
          {
            path: ':namespace',
            element: (
              <MetadataErrorBoundary>
                <LazyRouteWrapper><MetadataExplorer /></LazyRouteWrapper>
              </MetadataErrorBoundary>
            ),
            children: [
              {
                path: ':table',
                element: (
                  <MetadataErrorBoundary>
                    <LazyRouteWrapper><MetadataExplorer /></LazyRouteWrapper>
                  </MetadataErrorBoundary>
                ),
              },
            ],
          },
        ],
      },
      {
        path: 'upload',
        element: (
          <UploadErrorBoundary>
            <LazyRouteWrapper><DataUpload /></LazyRouteWrapper>
          </UploadErrorBoundary>
        ),
      },
      {
        path: 'config',
        element: (
          <ConfigErrorBoundary>
            <LazyRouteWrapper><Configuration /></LazyRouteWrapper>
          </ConfigErrorBoundary>
        ),
      },
      {
        path: '*',
        element: <LazyRouteWrapper><NotFound /></LazyRouteWrapper>,
      },
    ],
  },
];

export const router = createBrowserRouter(routes);

// Route type definitions
export type AppRoutes = 
  | '/'
  | '/query'
  | '/query/:queryId'
  | '/monitor'
  | '/monitor/workers'
  | '/monitor/workers/:workerId'
  | '/monitor/cluster'
  | '/metadata'
  | '/metadata/:namespace'
  | '/metadata/:namespace/:table'
  | '/upload'
  | '/config';

// Route metadata for navigation
export interface RouteMetadata {
  path: string;
  title: string;
  description?: string;
  icon?: string;
  requiresAuth?: boolean;
  preload?: boolean;
}

export const routeMetadata: Record<string, RouteMetadata> = {
  '/query': {
    path: '/query',
    title: 'Query Interface',
    description: 'Write and execute SQL queries',
    icon: 'search',
    preload: true,
  },
  '/monitor': {
    path: '/monitor',
    title: 'System Monitor',
    description: 'Monitor cluster health and performance',
    icon: 'activity',
    preload: true,
  },
  '/metadata': {
    path: '/metadata',
    title: 'Metadata Explorer',
    description: 'Browse tables and schemas',
    icon: 'database',
    preload: true,
  },
  '/upload': {
    path: '/upload',
    title: 'Data Upload',
    description: 'Upload and manage data files',
    icon: 'upload',
  },
  '/config': {
    path: '/config',
    title: 'Configuration',
    description: 'System settings and preferences',
    icon: 'settings',
  },
};

// Navigation utilities
export const getRouteTitle = (pathname: string): string => {
  // Find exact match first
  const exactMatch = routeMetadata[pathname];
  if (exactMatch) return exactMatch.title;
  
  // Find pattern match for dynamic routes
  for (const [pattern, metadata] of Object.entries(routeMetadata)) {
    if (pathname.startsWith(pattern.replace(/:\w+/g, ''))) {
      return metadata.title;
    }
  }
  
  return 'Mini Data Cloud';
};

export const getRouteBreadcrumbs = (pathname: string): Array<{ label: string; href?: string }> => {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: Array<{ label: string; href?: string }> = [
    { label: 'Home', href: '/' },
  ];
  
  let currentPath = '';
  
  for (const segment of segments) {
    currentPath += `/${segment}`;
    
    // Skip dynamic segments that are IDs
    if (segment.match(/^[a-f0-9-]{36}$/)) {
      breadcrumbs.push({ label: segment.substring(0, 8) + '...' });
      continue;
    }
    
    const metadata = routeMetadata[currentPath];
    if (metadata) {
      breadcrumbs.push({
        label: metadata.title,
        href: currentPath,
      });
    } else {
      // Capitalize segment for unknown routes
      breadcrumbs.push({
        label: segment.charAt(0).toUpperCase() + segment.slice(1),
        href: currentPath,
      });
    }
  }
  
  return breadcrumbs;
};

// Route preloading utilities
export const preloadRoute = async (routePath: string): Promise<void> => {
  const metadata = routeMetadata[routePath];
  if (!metadata?.preload) return;
  
  try {
    switch (routePath) {
      case '/query':
        await import('@/features/query/QueryInterface');
        break;
      case '/monitor':
        await import('@/features/monitor/SystemMonitor');
        break;
      case '/metadata':
        await import('@/features/metadata/MetadataExplorer');
        break;
      case '/upload':
        await import('@/features/upload/DataUpload');
        break;
      case '/config':
        await import('@/features/config/Configuration');
        break;
    }
  } catch (error) {
    console.warn(`Failed to preload route ${routePath}:`, error);
  }
};

// Hook for route preloading on hover/focus
export const useRoutePreloading = () => {
  const handleMouseEnter = (routePath: string) => {
    preloadRoute(routePath);
  };
  
  const handleFocus = (routePath: string) => {
    preloadRoute(routePath);
  };
  
  return { handleMouseEnter, handleFocus };
};