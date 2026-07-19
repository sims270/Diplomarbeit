import { StyleSheet, ScrollView, View, Text, Pressable, Modal, TextInput, ActivityIndicator, FlatList, Alert, Switch } from 'react-native';
import { Header } from '@/components/header';
import { StatusCard } from '@/components/status-card';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/hooks/use-translation';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { orderService, Order } from '../services/orderService';

const emptyOrderForm = {
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  pickupAddress: '',
  pickupCity: '',
  pickupZip: '',
  deliveryAddress: '',
  deliveryCity: '',
  deliveryZip: '',
  packageDescription: '',
  packageWeight: '',
  packageVolume: '',
  packageValue: '',
  packageFragile: false,
  priority: 'normal' as Order['priority'],
  pickupTime: '',
  deliveryTime: '',
};

export default function ChefDashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderForm, setOrderForm] = useState(emptyOrderForm);
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
      Alert.alert(t('common', 'error'), t('chefDashboard', 'alertSelectDriver'));
      return;
    }

    setIsSubmitting(true);
    try {
      orderService.assignOrderToDriver(selectedOrder.id, selectedDriver);
      loadData();
      setShowAssignModal(false);
      setSelectedOrder(null);
      setSelectedDriver(null);
      Alert.alert(
        t('common', 'success'),
        `${t('chefDashboard', 'orderPrefix')} ${selectedOrder.orderNumber} ${t('chefDashboard', 'alertAssignedSuccess')}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAssignModal = (order: Order) => {
    setSelectedOrder(order);
    setSelectedDriver(null);
    setShowAssignModal(true);
  };

  const buildScheduledTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(hours || 0, minutes || 0, 0, 0);
    return date.toISOString();
  };

  const handleCreateOrder = async () => {
    const {
      customerName, customerEmail, customerPhone,
      pickupAddress, pickupCity, pickupZip,
      deliveryAddress, deliveryCity, deliveryZip,
      packageDescription, pickupTime, deliveryTime,
    } = orderForm;

    if (
      !customerName.trim() || !customerEmail.trim() || !customerPhone.trim() ||
      !pickupAddress.trim() || !pickupCity.trim() || !pickupZip.trim() ||
      !deliveryAddress.trim() || !deliveryCity.trim() || !deliveryZip.trim() ||
      !packageDescription.trim() || !pickupTime.trim() || !deliveryTime.trim()
    ) {
      Alert.alert(t('common', 'error'), t('chefCreateOrder', 'alertFillFields'));
      return;
    }

    setIsCreatingOrder(true);
    try {
      orderService.addOrder({
        customer: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
        },
        pickupLocation: {
          address: pickupAddress,
          city: pickupCity,
          zipCode: pickupZip,
        },
        deliveryLocation: {
          address: deliveryAddress,
          city: deliveryCity,
          zipCode: deliveryZip,
        },
        package: {
          description: packageDescription,
          weight: orderForm.packageWeight || '0kg',
          volume: orderForm.packageVolume || '0m³',
          fragile: orderForm.packageFragile,
          value: Number(orderForm.packageValue) || 0,
        },
        priority: orderForm.priority,
        scheduledPickupTime: buildScheduledTime(pickupTime),
        scheduledDeliveryTime: buildScheduledTime(deliveryTime),
        createdBy: user?.id || '',
      });
      loadData();
      setShowCreateModal(false);
      setOrderForm(emptyOrderForm);
      Alert.alert(t('common', 'success'), t('chefCreateOrder', 'alertCreated'));
    } finally {
      setIsCreatingOrder(false);
    }
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
      pending: t('chefDashboard', 'statusPending'),
      assigned: t('chefDashboard', 'statusAssigned'),
      in_progress: t('chefDashboard', 'statusInProgress'),
      completed: t('chefDashboard', 'statusCompleted'),
      cancelled: t('chefDashboard', 'statusCancelled'),
    };
    return statusMap[status] || status;
  };

  return (
    <View style={styles.container}>
      <Header
        title="TRANSLOG PRO"
        subtitle={t('chefDashboard', 'headerSubtitle')}
        code="CH"
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusContainer}>
          <StatusCard
            count={stats.pending}
            label={t('chefDashboard', 'statusOpen')}
            color={Colors.ui.orange}
          />
          <StatusCard
            count={stats.assigned}
            label={t('chefDashboard', 'statusAssigned')}
            color={Colors.ui.blue}
          />
          <StatusCard
            count={stats.completed}
            label={t('chefDashboard', 'statusCompleted')}
            color={Colors.ui.green}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('chefDashboard', 'ordersToday')} ({orders.length})</Text>
            <Pressable style={styles.addButton} onPress={() => setShowCreateModal(true)}>
              <Text style={styles.addButtonText}>{t('chefDashboard', 'addOrderButton')}</Text>
            </Pressable>
          </View>

          {orders.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>{t('chefDashboard', 'emptyOrders')}</Text>
              <Text style={styles.emptyStateSubtext}>
                {t('chefDashboard', 'emptyOrdersSub')}
              </Text>
            </View>
          ) : (
            <FlatList
              scrollEnabled={false}
              data={orders}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.orderCard}
                  onPress={() => router.push({ pathname: '/chef/order/[id]', params: { id: item.id } })}
                >
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
                    {t('chefDashboard', 'from')}: {item.pickupLocation.city} → {item.deliveryLocation.city}
                  </Text>
                  {item.assignedTo ? (
                    <Text style={styles.assignedDriver}>
                      {t('chefDashboard', 'assignedTo')}: {drivers.find(d => d.id === item.assignedTo)?.name || t('common', 'unknown')}
                    </Text>
                  ) : (
                    <Pressable
                      style={styles.assignButton}
                      onPress={() => openAssignModal(item)}
                    >
                      <Text style={styles.assignButtonText}>{t('chefDashboard', 'assignButton')}</Text>
                    </Pressable>
                  )}
                </Pressable>
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
              <Text style={styles.modalTitle}>{t('chefDashboard', 'modalTitle')}</Text>
              <Pressable onPress={() => setShowAssignModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </Pressable>
            </View>

            {selectedOrder && (
              <>
                <Text style={styles.orderInfoTitle}>{selectedOrder.orderNumber}</Text>
                <Text style={styles.orderInfo}>{selectedOrder.customer.name}</Text>
                <Text style={styles.orderInfo}>{selectedOrder.package.description}</Text>

                <Text style={styles.driversTitle}>{t('chefDashboard', 'selectDriver')}</Text>
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
                        {item.status === 'online' ? `● ${t('common', 'online')}` : `● ${t('common', 'offline')}`}
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
                    <Text style={styles.cancelButtonText}>{t('common', 'cancel')}</Text>
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
                      <Text style={styles.submitButtonText}>{t('chefDashboard', 'assign')}</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('chefCreateOrder', 'modalTitle')}</Text>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.formSectionTitle}>{t('chefOrderDetail', 'customerSection')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('chefOrderDetail', 'nameLabel')}
                value={orderForm.customerName}
                onChangeText={(v) => setOrderForm({ ...orderForm, customerName: v })}
              />
              <TextInput
                style={styles.input}
                placeholder={t('chefOrderDetail', 'emailLabel')}
                value={orderForm.customerEmail}
                onChangeText={(v) => setOrderForm({ ...orderForm, customerEmail: v })}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder={t('chefOrderDetail', 'phoneLabel')}
                value={orderForm.customerPhone}
                onChangeText={(v) => setOrderForm({ ...orderForm, customerPhone: v })}
                keyboardType="phone-pad"
              />

              <Text style={styles.formSectionTitle}>{t('chefOrderDetail', 'pickupSection')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('chefOrderDetail', 'addressLabel')}
                value={orderForm.pickupAddress}
                onChangeText={(v) => setOrderForm({ ...orderForm, pickupAddress: v })}
              />
              <TextInput
                style={styles.input}
                placeholder={t('chefOrderDetail', 'cityLabel')}
                value={orderForm.pickupCity}
                onChangeText={(v) => setOrderForm({ ...orderForm, pickupCity: v })}
              />
              <TextInput
                style={styles.input}
                placeholder={t('chefOrderDetail', 'zipLabel')}
                value={orderForm.pickupZip}
                onChangeText={(v) => setOrderForm({ ...orderForm, pickupZip: v })}
              />
              <TextInput
                style={styles.input}
                placeholder={`${t('chefOrderDetail', 'pickupTimeLabel')} (${t('chefCreateOrder', 'timePlaceholder')})`}
                value={orderForm.pickupTime}
                onChangeText={(v) => setOrderForm({ ...orderForm, pickupTime: v })}
              />

              <Text style={styles.formSectionTitle}>{t('chefOrderDetail', 'deliverySection')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('chefOrderDetail', 'addressLabel')}
                value={orderForm.deliveryAddress}
                onChangeText={(v) => setOrderForm({ ...orderForm, deliveryAddress: v })}
              />
              <TextInput
                style={styles.input}
                placeholder={t('chefOrderDetail', 'cityLabel')}
                value={orderForm.deliveryCity}
                onChangeText={(v) => setOrderForm({ ...orderForm, deliveryCity: v })}
              />
              <TextInput
                style={styles.input}
                placeholder={t('chefOrderDetail', 'zipLabel')}
                value={orderForm.deliveryZip}
                onChangeText={(v) => setOrderForm({ ...orderForm, deliveryZip: v })}
              />
              <TextInput
                style={styles.input}
                placeholder={`${t('chefOrderDetail', 'deliveryTimeLabel')} (${t('chefCreateOrder', 'timePlaceholder')})`}
                value={orderForm.deliveryTime}
                onChangeText={(v) => setOrderForm({ ...orderForm, deliveryTime: v })}
              />

              <Text style={styles.formSectionTitle}>{t('chefOrderDetail', 'packageSection')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('chefOrderDetail', 'descriptionLabel')}
                value={orderForm.packageDescription}
                onChangeText={(v) => setOrderForm({ ...orderForm, packageDescription: v })}
              />
              <TextInput
                style={styles.input}
                placeholder={t('chefOrderDetail', 'weightLabel')}
                value={orderForm.packageWeight}
                onChangeText={(v) => setOrderForm({ ...orderForm, packageWeight: v })}
              />
              <TextInput
                style={styles.input}
                placeholder={t('chefOrderDetail', 'volumeLabel')}
                value={orderForm.packageVolume}
                onChangeText={(v) => setOrderForm({ ...orderForm, packageVolume: v })}
              />
              <TextInput
                style={styles.input}
                placeholder={t('chefOrderDetail', 'valueLabel')}
                value={orderForm.packageValue}
                onChangeText={(v) => setOrderForm({ ...orderForm, packageValue: v })}
                keyboardType="numeric"
              />
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t('chefOrderDetail', 'fragileLabel')}</Text>
                <Switch
                  value={orderForm.packageFragile}
                  onValueChange={(v) => setOrderForm({ ...orderForm, packageFragile: v })}
                  trackColor={{ true: Colors.ui.primary }}
                />
              </View>

              <Text style={styles.formSectionTitle}>{t('chefCreateOrder', 'priorityLabel')}</Text>
              <View style={styles.priorityRow}>
                {(
                  [
                    { value: 'normal', label: t('chefCreateOrder', 'priorityNormal') },
                    { value: 'high', label: t('chefCreateOrder', 'priorityHigh') },
                    { value: 'urgent', label: t('chefCreateOrder', 'priorityUrgent') },
                  ] as { value: Order['priority']; label: string }[]
                ).map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.priorityOption,
                      orderForm.priority === option.value && styles.priorityOptionSelected,
                    ]}
                    onPress={() => setOrderForm({ ...orderForm, priority: option.value })}
                  >
                    <Text
                      style={[
                        styles.priorityOptionText,
                        orderForm.priority === option.value && styles.priorityOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.modalButtonContainer}>
                <Pressable
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowCreateModal(false)}
                  disabled={isCreatingOrder}
                >
                  <Text style={styles.cancelButtonText}>{t('common', 'cancel')}</Text>
                </Pressable>

                <Pressable
                  style={[styles.modalButton, styles.submitButton, isCreatingOrder && styles.submitButtonDisabled]}
                  onPress={handleCreateOrder}
                  disabled={isCreatingOrder}
                >
                  {isCreatingOrder ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.submitButtonText}>{t('chefCreateOrder', 'createButton')}</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.lightGray,
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
    backgroundColor: '#FBEAEA',
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
  formSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.ui.charcoal,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontSize: 14,
    color: Colors.ui.charcoal,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 14,
    color: Colors.ui.charcoal,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.ui.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  priorityOptionSelected: {
    backgroundColor: Colors.ui.primary,
  },
  priorityOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.primary,
  },
  priorityOptionTextSelected: {
    color: 'white',
  },
});
