import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'

// Lazy load feature components for code splitting
import { lazy } from 'react'

const QueryInterface = lazy(() => import('@/features/query/QueryInterface'))
const SystemMonitor = lazy(() => import('@/features/monitor/SystemMonitor'))
const MetadataExplorer = lazy(() => import('@/features/metadata/MetadataExplorer'))
const DataUpload = lazy(() => import('@/features/upload/DataUpload'))
const Configuration = lazy(() => import('@/features/config/Configuration'))

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Navigate to="/query" replace />,
      },
      {
        path: 'query',
        element: <QueryInterface />,
      },
      {
        path: 'monitor',
        element: <SystemMonitor />,
      },
      {
        path: 'metadata',
        element: <MetadataExplorer />,
      },
      {
        path: 'upload',
        element: <DataUpload />,
      },
      {
        path: 'config',
        element: <Configuration />,
      },
    ],
  },
])

export type AppRoutes = 
  | '/'
  | '/query'
  | '/monitor'
  | '/metadata'
  | '/upload'
  | '/config'