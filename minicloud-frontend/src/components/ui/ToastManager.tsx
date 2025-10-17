import React from 'react';
import {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastContent,
} from './Toast';
import { useNotifications, useNotificationActions } from '@/store/notification-store';

// Toast Manager Component
export const ToastManager: React.FC = () => {
  const notifications = useNotifications();
  const { remove } = useNotificationActions();

  return (
    <ToastProvider swipeDirection="right">
      {notifications.map((notification) => (
        <Toast
          key={notification.id}
          variant={notification.type}
          duration={notification.duration ?? 5000}
          onOpenChange={(open) => {
            if (!open) {
              remove(notification.id);
            }
          }}
        >
          <ToastContent
            variant={notification.type}
            title={notification.title}
            message={notification.message}
            action={notification.action}
            dismissible={notification.dismissible}
            onClose={() => remove(notification.id)}
          />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
};