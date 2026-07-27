import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationContext';
/*import { OrderStatusUpdate } from '../services/notificationService';<*/

interface OrderStatusUpdateProps {
  orderId: string;
  currentStatus: string;
  driverId: string;
  location?: { latitude: number; longitude: number };
}

const STATUS_FLOW = ['assigned', 'in_progress', 'picked_up', 'delivered'];

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: 'Ausstehend',
    assigned: 'Zugewiesen',
    in_progress: 'Unterwegs',
    picked_up: 'Abgeholt',
    delivered: 'Zugestellt',
    cancelled: 'Storniert',
  };
  return labels[status] || status;
};

const getStatusIcon = (status: string): string => {
  const icons: Record<string, string> = {
    pending: 'clock-outline',
    assigned: 'check-circle-outline',
    in_progress: 'truck-fast',
    picked_up: 'package-variant',
    delivered: 'check-circle',
    cancelled: 'close-circle',
  };
  return icons[status] || 'help-circle';
};

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    pending: '#999',
    assigned: '#007AFF',
    in_progress: '#FF9500',
    picked_up: '#FF9500',
    delivered: '#34C759',
    cancelled: '#FF3B30',
  };
  return colors[status] || '#999';
};

export const OrderStatusUpdate: React.FC<OrderStatusUpdateProps> = ({
  orderId,
  currentStatus,
  driverId,
  location,
}) => {
  const { updateOrderStatus } = useNotifications();
  const [updating, setUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>(currentStatus);

  const handleStatusUpdate = async (newStatus: string) => {
    setUpdating(true);

    const update: OrderStatusUpdate = {
      orderId,
      status: newStatus as any,
      driverId,
      timestamp: new Date().toISOString(),
      location,
      notes: `Status aktualisiert zu ${getStatusLabel(newStatus)}`,
    };

    try {
      updateOrderStatus(update);
      setSelectedStatus(newStatus);

      Alert.alert('Erfolg', `Status aktualisiert zu: ${getStatusLabel(newStatus)}`);
    } catch {
      Alert.alert('Fehler', 'Status-Update konnte nicht übertragen werden');
    } finally {
      setUpdating(false);
    }
  };

  const nextPossibleStatuses = STATUS_FLOW.slice(
    STATUS_FLOW.indexOf(currentStatus) + 1
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Auftragsstatus: {orderId}</Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(selectedStatus) },
          ]}
        >
          <MaterialCommunityIcons
            name={getStatusIcon(selectedStatus)}
            size={16}
            color="#FFF"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.statusBadgeText}>{getStatusLabel(selectedStatus)}</Text>
        </View>
      </View>

      {/* Status Timeline */}
      <View style={styles.timeline}>
        {STATUS_FLOW.map((status, index) => {
          const isCompleted = STATUS_FLOW.indexOf(status) <= STATUS_FLOW.indexOf(selectedStatus);
          const isCurrent = status === selectedStatus;

          return (
            <View key={status} style={styles.timelineItem}>
              <View
                style={[
                  styles.timelineDot,
                  {
                    backgroundColor: isCompleted ? getStatusColor(status) : '#E5E5EA',
                    borderWidth: isCurrent ? 3 : 0,
                    borderColor: getStatusColor(status),
                  },
                ]}
              >
                {isCompleted && (
                  <MaterialCommunityIcons name="check" size={14} color="#FFF" />
                )}
              </View>

              {index < STATUS_FLOW.length - 1 && (
                <View
                  style={[
                    styles.timelineLine,
                    {
                      backgroundColor: isCompleted ? getStatusColor(status) : '#E5E5EA',
                    },
                  ]}
                />
              )}

              <Text
                style={[
                  styles.timelineLabel,
                  { color: isCompleted ? '#000' : '#999' },
                ]}
              >
                {getStatusLabel(status)}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Verfügbare Aktionen */}
      {nextPossibleStatuses.length > 0 && (
        <View style={styles.actions}>
          <Text style={styles.actionsTitle}>Nächster Status:</Text>
          {nextPossibleStatuses.map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.actionButton, { opacity: updating ? 0.5 : 1 }]}
              onPress={() => handleStatusUpdate(status)}
              disabled={updating}
              activeOpacity={0.7}
            >
              {updating ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name={getStatusIcon(status)}
                    size={20}
                    color="#FFF"
                  />
                  <Text style={styles.actionButtonText}>{getStatusLabel(status)}</Text>
                </>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {selectedStatus === 'delivered' && (
        <View style={styles.completedContainer}>
          <MaterialCommunityIcons name="check-circle" size={48} color="#34C759" />
          <Text style={styles.completedText}>Auftrag erfolgreich zugestellt!</Text>
        </View>
      )}

      {selectedStatus === 'cancelled' && (
        <View style={styles.cancelledContainer}>
          <MaterialCommunityIcons name="alert-circle" size={48} color="#FF3B30" />
          <Text style={styles.cancelledText}>Auftrag wurde storniert</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: 'center',
  },
  statusBadgeText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 12,
  },
  timeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 12,
  },
  timelineItem: {
    alignItems: 'center',
    flex: 1,
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#E5E5EA',
  },
  timelineLine: {
    position: 'absolute',
    height: 2,
    width: '100%',
    zIndex: -1,
    backgroundColor: '#E5E5EA',
  },
  timelineLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    color: '#999',
  },
  actions: {
    gap: 8,
  },
  actionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  actionButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  completedContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  completedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34C759',
    marginTop: 8,
  },
  cancelledContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  cancelledText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    marginTop: 8,
  },
});
