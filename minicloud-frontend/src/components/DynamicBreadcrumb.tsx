import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useBreadcrumb } from '../contexts/BreadcrumbContext';

// Base breadcrumb mapping for different routes
const baseBreadcrumbMap: Record<string, { title: string; href?: string }> = {
  '/': { title: 'Upload', href: '/' },
  '/upload': { title: 'Upload', href: '/upload' },
  '/tables': { title: 'Tables', href: '/tables' },
  '/query': { title: 'Query', href: '/query' },
  '/monitoring': { title: 'Monitoring', href: '/monitoring' },
};

export const DynamicBreadcrumb: React.FC = () => {
  const location = useLocation();
  const { breadcrumbs } = useBreadcrumb();
  const currentPath = location.pathname;
  
  // Get the base breadcrumb for the current route
  const baseBreadcrumb = baseBreadcrumbMap[currentPath];
  
  // Build the complete breadcrumb trail
  const allBreadcrumbs = [];
  
  // Always start with Mini Data Cloud
  allBreadcrumbs.push({ title: 'Mini Data Cloud', href: '/' });
  
  // Add the base route if it exists and is not the home page
  if (baseBreadcrumb && currentPath !== '/') {
    allBreadcrumbs.push(baseBreadcrumb);
  }
  
  // Add any dynamic breadcrumbs from context
  allBreadcrumbs.push(...breadcrumbs);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {allBreadcrumbs.map((crumb, index) => (
          <React.Fragment key={`${crumb.title}-${index}`}>
            <BreadcrumbItem className={index === 0 ? "hidden md:block" : ""}>
              {index === allBreadcrumbs.length - 1 ? (
                // Last item is always a page (not clickable)
                <BreadcrumbPage>{crumb.title}</BreadcrumbPage>
              ) : (
                // Other items are links
                <BreadcrumbLink href={crumb.href || '#'}>
                  {crumb.title}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {index < allBreadcrumbs.length - 1 && (
              <BreadcrumbSeparator className={index === 0 ? "hidden md:block" : ""} />
            )}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
};