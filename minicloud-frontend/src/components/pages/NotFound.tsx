import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const NotFound: React.FC = () => {
  const location = useLocation();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <Card className="max-w-md w-full text-center p-8">
        <div className="mb-6">
          <div className="text-6xl font-bold text-gray-300 dark:text-gray-600 mb-4">
            404
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Page Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The page <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm">
              {location.pathname}
            </code> could not be found.
          </p>
        </div>

        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link to="/">
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </Link>
          </Button>
          
          <Button variant="outline" onClick={() => window.history.back()} className="w-full">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
          
          <Button variant="ghost" asChild className="w-full">
            <Link to="/query">
              <Search className="h-4 w-4 mr-2" />
              Start Querying
            </Link>
          </Button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Need help? Check out our{' '}
            <Link 
              to="/config" 
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              documentation
            </Link>{' '}
            or{' '}
            <Link 
              to="/monitor" 
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              system status
            </Link>
            .
          </p>
        </div>
      </Card>
    </div>
  );
};

export default NotFound;