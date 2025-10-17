import { createBrowserRouter, Navigate } from 'react-router-dom';
import { SimpleLayout } from '@/components/layout/SimpleLayout';
import { lazy, Suspense } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// Lazy load feature components
const QueryInterface = lazy(() => import('@/features/query/QueryInterface'));
const SystemMonitor = lazy(() => import('@/features/monitor/SystemMonitor'));
const MetadataExplorer = lazy(() => import('@/features/metadata/MetadataExplorer'));
const DataUpload = lazy(() => import('@/features/upload/DataUpload'));
const Configuration = lazy(() => import('@/features/config/Configuration'));

// Simple wrapper for lazy components
const LazyWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<LoadingSpinner />}>
    {children}
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <SimpleLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/query" replace />,
      },
      {
        path: 'query',
        element: <LazyWrapper><QueryInterface /></LazyWrapper>,
      },
      {
        path: 'monitor',
        element: <LazyWrapper><SystemMonitor /></LazyWrapper>,
      },
      {
        path: 'metadata',
        element: <LazyWrapper><MetadataExplorer /></LazyWrapper>,
      },
      {
        path: 'upload',
        element: <LazyWrapper><DataUpload /></LazyWrapper>,
      },
      {
        path: 'config',
        element: <LazyWrapper><Configuration /></LazyWrapper>,
      },
    ],
  },
]);

// Simple route metadata
export const routeMetadata = {
  '/query': { title: 'Query Interface' },
  '/monitor': { title: 'System Monitor' },
  '/metadata': { title: 'Metadata Explorer' },
  '/upload': { title: 'Data Upload' },
  '/config': { title: 'Configuration' },
};

export const getRouteTitle = (pathname: string): string => {
  const route = routeMetadata[pathname as keyof typeof routeMetadata];
  return route?.title || 'Mini Data Cloud';
};

export const getRouteBreadcrumbs = (pathname: string) => {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = [{ label: 'Home', href: '/' }];
  
  if (segments.length > 0) {
    const mainPath = `/${segments[0]}`;
    const route = routeMetadata[mainPath as keyof typeof routeMetadata];
    if (route) {
      breadcrumbs.push({ label: route.title, href: mainPath });
    }
  }
  
  return breadcrumbs;
};