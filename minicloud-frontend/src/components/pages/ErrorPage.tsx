import React from 'react';
import { Link, useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { AlertTriangle, Home, RefreshCw, Bug } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const ErrorPage: React.FC = () => {
  const error = useRouteError();

  const getErrorInfo = () => {
    if (isRouteErrorResponse(error)) {
      return {
        title: `${error.status} ${error.statusText}`,
        message: error.data?.message || 'An error occurred while loading this page.',
        details: error.data,
      };
    }

    if (error instanceof Error) {
      return {
        title: 'Application Error',
        message: error.message || 'An unexpected error occurred.',
        details: process.env['NODE_ENV'] === 'development' ? error.stack : undefined,
      };
    }

    return {
      title: 'Unknown Error',
      message: 'An unknown error occurred.',
      details: undefined,
    };
  };

  const errorInfo = getErrorInfo();

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleReportError = () => {
    // In a real app, this would open a bug report form or send to error tracking
    console.error('User reported error:', error);
    alert('Error reported. Thank you for helping us improve!');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900">
      <Card className="max-w-lg w-full text-center p-8">
        <div className="mb-6">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {errorInfo.title}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {errorInfo.message}
          </p>
        </div>

        <div className="space-y-3 mb-6">
          <Button onClick={handleRefresh} className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Page
          </Button>
          
          <Button variant="outline" asChild className="w-full">
            <Link to="/">
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </Link>
          </Button>
          
          <Button variant="ghost" onClick={handleReportError} className="w-full">
            <Bug className="h-4 w-4 mr-2" />
            Report Issue
          </Button>
        </div>

        {errorInfo.details && process.env['NODE_ENV'] === 'development' && (
          <details className="text-left">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 mb-2">
              Error Details (Development)
            </summary>
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-mono overflow-auto max-h-40">
              <pre className="whitespace-pre-wrap">{errorInfo.details}</pre>
            </div>
          </details>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            If this problem persists, please check the{' '}
            <Link 
              to="/monitor" 
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              system status
            </Link>{' '}
            or contact support.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ErrorPage;