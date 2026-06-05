import { useCallback, useState, useEffect } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { Notification, OrderStatusUpdate } from '../services/notificationService';

/**
 * Hook für Filtern und Verwalten von Benachrichtigungen
 */
export const useNotificationFilter = (filter?: 'unread' | 'read' | string) => {
  const { notifications } = useNotifications();
  const [filtered, setFiltered] = useState<Notification[]>([]);

  useEffect(() => {
    let result = notifications;

    if (filter === 'unread') {
      result = notifications.filter((n) => n.status === 'unread');
    } else if (filter === 'read') {
      result = notifications.filter((n) => n.status === 'read');
    } else if (filter) {
      result = notifications.filter((n) => n.type === filter);
    }

    setFiltered(result);
  }, [notifications, filter]);

  return filtered;
};

/**
 * Hook für Auftrag-Status-Updates mit lokaler State
 */
export const useOrderStatusTracking = (orderId: string, initialStatus: string) => {
  const { updateOrderStatus } = useNotifications();
  const [status, setStatus] = useState(initialStatus);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<OrderStatusUpdate | null>(null);

  const updateStatus = useCallback(
    async (
      newStatus: string,
      driverId: string,
      location?: { latitude: number; longitude: number }
    ) => {
      setIsUpdating(true);

      const update: OrderStatusUpdate = {
        orderId,
        status: newStatus as any,
        driverId,
        timestamp: new Date().toISOString(),
        location,
      };

      try {
        updateOrderStatus(update);
        setStatus(newStatus);
        setLastUpdate(update);
        return true;
      } catch (error) {
        console.error('Status update failed:', error);
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [orderId, updateOrderStatus]
  );

  return {
    status,
    isUpdating,
    lastUpdate,
    updateStatus,
  };
};

/**
 * Hook für Benachrichtigungen nach Priorität sortieren
 */
export const useNotificationsSorted = (ascending = false) => {
  const { notifications } = useNotifications();
  const [sorted, setSorted] = useState<Notification[]>([]);

  const priorityOrder: Record<string, number> = {
    urgent: 0,
    high: 1,
    normal: 2,
    low: 3,
  };

  useEffect(() => {
    const result = [...notifications].sort((a, b) => {
      const aPriority = priorityOrder[a.priority] || 999;
      const bPriority = priorityOrder[b.priority] || 999;

      if (ascending) {
        return aPriority - bPriority;
      }
      return bPriority - aPriority;
    });

    setSorted(result);
  }, [notifications, ascending]);

  return sorted;
};

/**
 * Hook für Überwachung von Benachrichtigungen eines bestimmten Auftrags
 */
export const useOrderNotifications = (orderId: string) => {
  const notifications = useNotificationFilter();
  const [orderNotifications, setOrderNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const filtered = notifications.filter((n) => n.orderId === orderId);
    setOrderNotifications(filtered);
  }, [notifications, orderId]);

  return orderNotifications;
};

/**
 * Hook für Status-Updates in Echtzeit überwachen
 */
export const useOrderStatusUpdates = (
  orderId: string,
  onStatusChange?: (status: string) => void
) => {
  const { notifications } = useNotifications();
  const [latestUpdate, setLatestUpdate] = useState<Notification | null>(null);

  useEffect(() => {
    const statusNotifications = notifications.filter(
      (n) => n.orderId === orderId && n.type === 'order_status_changed'
    );

    if (statusNotifications.length > 0) {
      const latest = statusNotifications[0];
      setLatestUpdate(latest);

      if (onStatusChange && latest.data?.newStatus) {
        onStatusChange(latest.data.newStatus);
      }
    }
  }, [notifications, orderId, onStatusChange]);

  return latestUpdate;
};
