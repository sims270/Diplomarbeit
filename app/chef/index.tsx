import { StyleSheet, ScrollView, View, Text, Pressable, Modal, TextInput, ActivityIndicator, FlatList, Alert } from 'react-native';
import { Header } from '@/components/header';
import { StatusCard } from '@/components/status-card';
import { Colors } from '@/constants/theme';
import { useState, useEffect } from 'react';
import { orderService, Order } from '../services/orderService';

export default function ChefDashboardScreen() {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, assigned: 0, inProgress: 0, completed: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setOrders(orderService.getAllOrders());
    setDrivers(orderService.getDrivers());
    setStats(orderService.getOrderStats());
  };

  const handleAssignOrder = async () => {
    if (!selectedOrder || !selectedDriver) {
      Alert.alert('Fehler', 'Bitte einen Fahrer auswählen');
      return;
    }

    setIsSubmitting(true);
    try {
      orderService.assignOrderToDriver(selectedOrder.id, selectedDriver);
      loadData();
      setShowAssignModal(false);
      setSelectedOrder(null);
      setSelectedDriver(null);
      Alert.alert('Erfolg', `Auftrag ${selectedOrder.orderNumber} zugewiesen!`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAssignModal = (order: Order) => {
    setSelectedOrder(order);
    setSelectedDriver(null);
    setShowAssignModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return Colors.ui.orange;
      case 'assigned':
      case 'in_progress':
        return Colors.ui.blue;
      case 'completed':
        return Colors.ui.green;
      default:
        return Colors.ui.darkGray;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'AUSSTEHEND',
      assigned: 'ZUGEWIESEN',
      in_progress: 'UNTERWEGS',
      completed: 'ERLEDIGT',
      cancelled: 'STORNIERT',
    };
    return statusMap[status] || status;
  };

  return (
    <View style={styles.container}>
      <Header
        title="TRANSLOG PRO"
        subtitle="CHEF-DASHBOARD"
        code="CH"
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusContainer}>
          <StatusCard
            count={stats.pending}
            label="OFFEN"
            color={Colors.ui.orange}
          />
          <StatusCard
            count={stats.assigned}
            label="ZUGEWIESEN"
            color={Colors.ui.blue}
          />
          <StatusCard
            count={stats.completed}
            label="ERLEDIGT"
            color={Colors.ui.green}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>AUFTRÄGE HEUTE ({orders.length})</Text>
          </View>

          {orders.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Keine Aufträge vorhanden</Text>
              <Text style={styles.emptyStateSubtext}>
                Neue Aufträge werden hier angezeigt
              </Text>
            </View>
          ) : (
            <FlatList
              scrollEnabled={false}
              data={orders}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.orderCard}>
                  <View style={styles.orderHeader}>
                    <Text style={styles.orderNumber}>{item.orderNumber}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(item.status) },
                      ]}
                    >
                      <Text style={styles.statusBadgeText}>
                        {getStatusText(item.status)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.customerName}>{item.customer.name}</Text>
                  <Text style={styles.packageDesc}>{item.package.description}</Text>
                  <Text style={styles.location}>
                    Von: {item.pickupLocation.city} → {item.deliveryLocation.city}
                  </Text>
                  {item.assignedTo ? (
                    <Text style={styles.assignedDriver}>
                      Zugewiesen: {drivers.find(d => d.id === item.assignedTo)?.name || 'Unbekannt'}
                    </Text>
                  ) : (
                    <Pressable
                      style={styles.assignButton}
                      onPress={() => openAssignModal(item)}
                    >
                      <Text style={styles.assignButtonText}>+ ZUWEISEN</Text>
                    </Pressable>
                  )}
                </View>
              )}
            />
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showAssignModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAssignModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>AUFTRAG ZUWEISEN</Text>
              <Pressable onPress={() => setShowAssignModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </Pressable>
            </View>

            {selectedOrder && (
              <>
                <Text style={styles.orderInfoTitle}>{selectedOrder.orderNumber}</Text>
                <Text style={styles.orderInfo}>{selectedOrder.customer.name}</Text>
                <Text style={styles.orderInfo}>{selectedOrder.package.description}</Text>

                <Text style={styles.driversTitle}>Fahrer auswählen:</Text>
                <FlatList
                  scrollEnabled={false}
                  data={drivers}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[
                        styles.driverOption,
                        selectedDriver === item.id && styles.driverOptionSelected,
                      ]}
                      onPress={() => setSelectedDriver(item.id)}
                    >
                      <View
                        style={[
                          styles.driverRadio,
                          selectedDriver === item.id && styles.driverRadioSelected,
                        ]}
                      >
                        {selectedDriver === item.id && (
                          <Text style={styles.driverRadioMark}>●</Text>
                        )}
                      </View>
                      <Text style={styles.driverName}>{item.name}</Text>
                      <Text
                        style={[
                          styles.driverStatus,
                          item.status === 'online'
                            ? { color: Colors.ui.green }
                            : { color: Colors.ui.darkGray },
                        ]}
                      >
                        {item.status === 'online' ? '● Online' : '● Offline'}
                      </Text>
                    </Pressable>
                  )}
                />

                <View style={styles.modalButtonContainer}>
                  <Pressable
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setShowAssignModal(false)}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.cancelButtonText}>Abbrechen</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.modalButton,
                      styles.submitButton,
                      (!selectedDriver || isSubmitting) && styles.submitButtonDisabled,
                    ]}
                    onPress={handleAssignOrder}
                    disabled={!selectedDriver || isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.submitButtonText}>ZUWEISEN</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    flex: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    textTransform: 'uppercase',
  },
  addButton: {
    backgroundColor: Colors.ui.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  driverText: {
    fontSize: 14,
    color: Colors.ui.darkGray,
    lineHeight: 20,
  },
  emptyState: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: Colors.ui.lightGray,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ui.darkGray,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.ui.darkGray,
    textAlign: 'center',
  },
  orderCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.ui.primary,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  customerName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  packageDesc: {
    fontSize: 12,
    color: Colors.ui.darkGray,
    marginBottom: 4,
  },
  location: {
    fontSize: 11,
    color: Colors.ui.darkGray,
    marginBottom: 8,
  },
  assignedDriver: {
    fontSize: 11,
    color: Colors.ui.green,
    fontWeight: '600',
  },
  assignButton: {
    backgroundColor: Colors.ui.primary,
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  assignButtonText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  closeButton: {
    fontSize: 24,
    color: Colors.ui.darkGray,
  },
  orderInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
  },
  orderInfo: {
    fontSize: 12,
    color: Colors.ui.darkGray,
    marginBottom: 4,
  },
  driversTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 12,
  },
  driverOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: Colors.ui.lightGray,
  },
  driverOptionSelected: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: Colors.ui.primary,
  },
  driverRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.ui.darkGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverRadioSelected: {
    borderColor: Colors.ui.primary,
  },
  driverRadioMark: {
    color: Colors.ui.primary,
    fontSize: 12,
  },
  driverName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
    flex: 1,
  },
  driverStatus: {
    fontSize: 11,
    fontWeight: '600',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.ui.lightGray,
  },
  cancelButtonText: {
    color: Colors.light.text,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: Colors.ui.primary,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});
