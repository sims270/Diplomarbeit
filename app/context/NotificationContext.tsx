import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import notificationService, { Notification, OrderStatusUpdate } from '../services/notificationService';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  markAsRead: (id: string) => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  updateOrderStatus: (update: OrderStatusUpdate) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode; userId: string }> = ({
  children,
  userId,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Verbindung initialisieren
    notificationService.connect(userId).catch(console.error);

    // Event Listener
    const handleNewNotification = (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    };

    const handleNotificationRead = (notification: Notification) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? notification : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    };

    const handleNotificationDeleted = (notificationId: string) => {
      setNotifications((prev) => {
        const notification = prev.find((n) => n.id === notificationId);
        if (notification?.status === 'unread') {
          setUnreadCount((count) => Math.max(0, count - 1));
        }
        return prev.filter((n) => n.id !== notificationId);
      });
    };

    const handleNotificationsCleared = () => {
      setNotifications([]);
      setUnreadCount(0);
    };

    const handleConnected = () => setIsConnected(true);
    const handleDisconnected = () => setIsConnected(false);

    notificationService.on('notification', handleNewNotification);
    notificationService.on('notification:marked_as_read', handleNotificationRead);
    notificationService.on('notification:deleted', handleNotificationDeleted);
    notificationService.on('notifications:cleared', handleNotificationsCleared);
    notificationService.on('connected', handleConnected);
    notificationService.on('disconnected', handleDisconnected);

    return () => {
      notificationService.off('notification', handleNewNotification);
      notificationService.off('notification:marked_as_read', handleNotificationRead);
      notificationService.off('notification:deleted', handleNotificationDeleted);
      notificationService.off('notifications:cleared', handleNotificationsCleared);
      notificationService.off('connected', handleConnected);
      notificationService.off('disconnected', handleDisconnected);
      notificationService.disconnect();
    };
  }, [userId]);

  const markAsRead = useCallback((id: string) => {
    notificationService.markAsRead(id);
  }, []);

  const deleteNotification = useCallback((id: string) => {
    notificationService.deleteNotification(id);
  }, []);

  const clearAll = useCallback(() => {
    notificationService.clearAll();
  }, []);

  const updateOrderStatus = useCallback((update: OrderStatusUpdate) => {
    notificationService.updateOrderStatus(update);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isConnected,
        markAsRead,
        deleteNotification,
        clearAll,
        updateOrderStatus,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications muss innerhalb NotificationProvider verwendet werden');
  }
  return context;
};
