import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRouteBreadcrumbs } from '@/lib/router';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
  showHome?: boolean;
  separator?: React.ReactNode;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  className,
  showHome = true,
  separator = <ChevronRight className="h-4 w-4" />,
}) => {
  const location = useLocation();
  
  // Use provided items or generate from current route
  const breadcrumbItems = items || getRouteBreadcrumbs(location.pathname);
  
  // Filter out home if not showing it
  const displayItems = showHome ? breadcrumbItems : breadcrumbItems.slice(1);
  
  if (displayItems.length <= 1) {
    return null;
  }

  return (
    <nav 
      className={cn('flex items-center space-x-1 text-sm', className)}
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center space-x-1">
        {displayItems.map((item, index) => {
          const isLast = index === displayItems.length - 1;
          const isHome = item.href === '/';
          
          return (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <span className="text-gray-400 dark:text-gray-500 mx-2">
                  {separator}
                </span>
              )}
              
              {isLast ? (
                <span 
                  className="font-medium text-gray-900 dark:text-gray-100"
                  aria-current="page"
                >
                  {isHome ? <Home className="h-4 w-4" /> : item.label}
                </span>
              ) : (
                <Link
                  to={item.href || '#'}
                  className={cn(
                    'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                    'transition-colors duration-200',
                    'flex items-center'
                  )}
                >
                  {isHome ? <Home className="h-4 w-4" /> : item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

// Hook for managing breadcrumbs in components
export const useBreadcrumbs = (items?: BreadcrumbItem[]) => {
  const location = useLocation();
  
  const breadcrumbs = React.useMemo(() => {
    if (items) return items;
    return getRouteBreadcrumbs(location.pathname);
  }, [items, location.pathname]);
  
  return breadcrumbs;
};

// Breadcrumb item component for custom breadcrumbs
export const BreadcrumbItem: React.FC<{
  children: React.ReactNode;
  href?: string;
  isLast?: boolean;
}> = ({ children, href, isLast }) => {
  if (isLast) {
    return (
      <span className="font-medium text-gray-900 dark:text-gray-100" aria-current="page">
        {children}
      </span>
    );
  }

  if (href) {
    return (
      <Link
        to={href}
        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200"
      >
        {children}
      </Link>
    );
  }

  return (
    <span className="text-gray-500 dark:text-gray-400">
      {children}
    </span>
  );
};