import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Notification } from '../services/notificationService';
import { useNotifications } from '../context/NotificationContext';

interface NotificationItemProps {
  notification: Notification;
  onPress?: () => void;
}

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'urgent':
      return '#FF3B30';
    case 'high':
      return '#FF9500';
    case 'normal':
      return '#007AFF';
    case 'low':
      return '#8E8E93';
    default:
      return '#007AFF';
  }
};

const getPriorityIcon = (priority: string): string => {
  switch (priority) {
    case 'urgent':
      return 'alert-circle';
    case 'high':
      return 'alert';
    case 'normal':
      return 'information';
    default:
      return 'information-outline';
  }
};

const getTypeIcon = (type: string): string => {
  switch (type) {
    case 'order_assigned':
      return 'package-variant-closed';
    case 'order_status_changed':
      return 'update';
    case 'order_delivered':
      return 'check-circle';
    case 'order_cancelled':
      return 'close-circle';
    default:
      return 'bell';
  }
};

export const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onPress }) => {
  const { markAsRead, deleteNotification } = useNotifications();

  const handlePress = () => {
    if (notification.status === 'unread') {
      markAsRead(notification.id);
    }
    onPress?.();
  };

  const handleDelete = () => {
    deleteNotification(notification.id);
  };

  const priorityColor = getPriorityColor(notification.priority);
  const isUnread = notification.status === 'unread';

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        styles.container,
        isUnread ? styles.unread : styles.read,
        { borderLeftColor: priorityColor },
      ]}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons
          name={getTypeIcon(notification.type)}
          size={24}
          color={priorityColor}
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{notification.title}</Text>
        <Text style={styles.message} numberOfLines={2}>
          {notification.message}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.timestamp}>
            {new Date(notification.createdAt).toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          {isUnread && <View style={styles.unreadBadge} />}
        </View>
      </View>

      <TouchableOpacity
        onPress={handleDelete}
        style={styles.deleteButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons name="close" size={20} color="#999" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 12,
    marginVertical: 4,
    marginHorizontal: 0,
    backgroundColor: '#FFF',
    borderLeftWidth: 4,
    alignItems: 'flex-start',
  },
  unread: {
    backgroundColor: '#F8F9FF',
  },
  read: {
    backgroundColor: '#FAFAFA',
  },
  iconContainer: {
    marginRight: 12,
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  message: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timestamp: {
    fontSize: 11,
    color: '#999',
  },
  unreadBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
});
