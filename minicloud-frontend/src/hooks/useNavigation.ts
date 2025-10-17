import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { preloadRoute, type AppRoutes } from '@/lib/router';
import { useUIStore } from '@/store/ui-store';

export const useNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setActiveTab, setBreadcrumbs } = useUIStore();

  // Navigate with preloading and state updates
  const navigateTo = useCallback((path: AppRoutes, options?: { replace?: boolean }) => {
    // Update active tab based on route
    const mainPath = path.split('/')[1] || 'query';
    setActiveTab(mainPath);
    
    // Navigate
    navigate(path, options);
  }, [navigate, setActiveTab]);

  // Preload route on hover/focus
  const handleRoutePreload = useCallback((path: string) => {
    preloadRoute(path);
  }, []);

  // Check if route is active
  const isActive = useCallback((path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  }, [location.pathname]);

  // Get current route info
  const getCurrentRoute = useCallback(() => {
    return {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      state: location.state,
    };
  }, [location]);

  return {
    navigateTo,
    handleRoutePreload,
    isActive,
    getCurrentRoute,
    currentPath: location.pathname,
  };
};

// Hook for managing navigation state
export const useNavigationState = () => {
  const { activeTab, setActiveTab } = useUIStore();
  const location = useLocation();

  // Sync active tab with current route
  const syncActiveTab = useCallback(() => {
    const mainPath = location.pathname.split('/')[1] || 'query';
    if (activeTab !== mainPath) {
      setActiveTab(mainPath);
    }
  }, [location.pathname, activeTab, setActiveTab]);

  return {
    activeTab,
    setActiveTab,
    syncActiveTab,
  };
};