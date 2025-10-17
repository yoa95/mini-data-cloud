import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// Notification types
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string | undefined;
  duration?: number; // in milliseconds, 0 means persistent
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
  timestamp: Date;
}

// Notification state interface
interface NotificationState {
  notifications: Notification[];
  
  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => string;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  clearNotificationsByType: (type: NotificationType) => void;
  
  // Convenience methods
  success: (title: string, message?: string, options?: Partial<Notification>) => string;
  error: (title: string, message?: string, options?: Partial<Notification>) => string;
  warning: (title: string, message?: string, options?: Partial<Notification>) => string;
  info: (title: string, message?: string, options?: Partial<Notification>) => string;
}

// Generate unique ID for notifications
const generateId = () => `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Default notification settings
const DEFAULT_DURATION = 5000; // 5 seconds
const ERROR_DURATION = 8000; // 8 seconds for errors
const SUCCESS_DURATION = 4000; // 4 seconds for success

// Create the notification store
export const useNotificationStore = create<NotificationState>()(
  immer((set, get) => ({
    notifications: [],

    addNotification: (notification) => {
      const id = generateId();
      const newNotification: Notification = {
        id,
        timestamp: new Date(),
        dismissible: true,
        duration: DEFAULT_DURATION,
        ...notification,
      };

      set((state) => {
        state.notifications.push(newNotification);
      });

      // Auto-remove notification after duration (if not persistent)
      if (newNotification.duration && newNotification.duration > 0) {
        setTimeout(() => {
          get().removeNotification(id);
        }, newNotification.duration);
      }

      return id;
    },

    removeNotification: (id) => set((state) => {
      state.notifications = state.notifications.filter(n => n.id !== id);
    }),

    clearNotifications: () => set((state) => {
      state.notifications = [];
    }),

    clearNotificationsByType: (type) => set((state) => {
      state.notifications = state.notifications.filter(n => n.type !== type);
    }),

    // Convenience methods
    success: (title, message, options = {}) => {
      return get().addNotification({
        type: 'success',
        title,
        message,
        duration: SUCCESS_DURATION,
        ...options,
      });
    },

    error: (title, message, options = {}) => {
      return get().addNotification({
        type: 'error',
        title,
        message,
        duration: ERROR_DURATION,
        ...options,
      });
    },

    warning: (title, message, options = {}) => {
      return get().addNotification({
        type: 'warning',
        title,
        message,
        duration: DEFAULT_DURATION,
        ...options,
      });
    },

    info: (title, message, options = {}) => {
      return get().addNotification({
        type: 'info',
        title,
        message,
        duration: DEFAULT_DURATION,
        ...options,
      });
    },
  }))
);

// Selectors
export const useNotifications = () => useNotificationStore((state) => state.notifications);
// Individual action selectors to avoid object creation
export const useAddNotification = () => useNotificationStore((state) => state.addNotification);
export const useRemoveNotification = () => useNotificationStore((state) => state.removeNotification);
export const useClearNotifications = () => useNotificationStore((state) => state.clearNotifications);
export const useSuccessNotification = () => useNotificationStore((state) => state.success);
export const useErrorNotification = () => useNotificationStore((state) => state.error);
export const useWarningNotification = () => useNotificationStore((state) => state.warning);
export const useInfoNotification = () => useNotificationStore((state) => state.info);

// Individual count selectors to avoid object creation
export const useNotificationCount = () => useNotificationStore((state) => state.notifications.length);
export const useErrorNotificationCount = () => useNotificationStore((state) => 
  state.notifications.filter(n => n.type === 'error').length
);

// Hook for latest notifications
export const useLatestNotifications = (limit: number = 5) => useNotificationStore((state) => 
  state.notifications
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit)
);