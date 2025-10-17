import { useNotificationStore } from '@/store/notification-store';
import type { NotificationType } from '@/store/notification-store';

interface ToastOptions {
  title: string;
  description?: string;
  variant?: NotificationType | 'destructive';
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
}

export const useToast = () => {
  const { addNotification, success, error, warning, info } = useNotificationStore();

  const toast = (options: ToastOptions) => {
    const { title, description, variant = 'info', ...rest } = options;
    
    // Map destructive to error for the notification system
    const notificationType: NotificationType = variant === 'destructive' ? 'error' : variant as NotificationType;
    
    return addNotification({
      type: notificationType,
      title,
      message: description,
      ...rest,
    });
  };

  return {
    toast,
    success: (title: string, description?: string, options?: Partial<ToastOptions>) =>
      success(title, description, options),
    error: (title: string, description?: string, options?: Partial<ToastOptions>) =>
      error(title, description, options),
    warning: (title: string, description?: string, options?: Partial<ToastOptions>) =>
      warning(title, description, options),
    info: (title: string, description?: string, options?: Partial<ToastOptions>) =>
      info(title, description, options),
  };
};