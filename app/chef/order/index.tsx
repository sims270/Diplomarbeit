import { useAuth } from '@/app/context/AuthContext';
import { Driver, getDrivers } from '@/app/services/driverService';
import { assignOrderToDriver, getAllOrders, type Order } from '@/app/services/orderService';
import { BlurSurface } from '@/components/fluid/BlurSurface';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Colors } from '@/constants/theme';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert } from '@/lib/alert';
import { isoToGerman } from '@/lib/dateFormat';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function OrdersListScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isOfflineMode } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoadError(false);
    try {
      setOrders(await getAllOrders());
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Real drivers a boss created via Fahrerverwaltung.
  const loadDrivers = useCallback(async () => {
    if (isOfflineMode) {
      setDrivers([]);
      return;
    }
    try {
      setDrivers(await getDrivers());
    } catch {
      setDrivers([]);
    }
  }, [isOfflineMode]);

  // Refresh every time this screen becomes active (e.g. after creating or
  // editing an order and navigating back).
  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadOrders();
      loadDrivers();
    }, [loadOrders, loadDrivers])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadOrders();
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

  const openAssignModal = (order: Order) => {
    setSelectedOrder(order);
    setSelectedDriver(null);
    setShowAssignModal(true);
  };

  const handleAssignOrder = async () => {
    if (!selectedOrder || !selectedDriver) {
      showAlert(t('common', 'error'), t('chefDashboard', 'alertSelectDriver'));
      return;
    }

    setIsSubmitting(true);
    try {
      await assignOrderToDriver(selectedOrder.id, selectedDriver);
      await loadOrders();
      setShowAssignModal(false);
      setSelectedOrder(null);
      setSelectedDriver(null);
      showAlert(
        t('common', 'success'),
        `${t('chefDashboard', 'orderPrefix')} ${selectedOrder.orderNr} ${t('chefDashboard', 'alertAssignedSuccess')}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      showAlert(t('common', 'error'), message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('chefOrdersList', 'headerSubtitle')} code="CH" />

      <View style={styles.content}>
        <FluidPressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('chefOrdersList', 'title')} ({orders.length})
          </Text>
          <FluidPressable style={styles.addButton} onPress={() => router.push('/chef/order/new')}>
            <Text style={styles.addButtonText}>{t('chefOrdersList', 'addButton')}</Text>
          </FluidPressable>
        </View>

        {isLoading ? (
          <ActivityIndicator style={styles.loading} color={Colors.ui.primary} />
        ) : loadError ? (
          <Text style={styles.errorText}>{t('chefOrdersList', 'loadFailed')}</Text>
        ) : orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{t('chefOrdersList', 'emptyState')}</Text>
            <Text style={styles.emptyStateSubtext}>{t('chefOrdersList', 'emptyStateSub')}</Text>
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
            }
            renderItem={({ item }) => (
              <FluidPressable
                style={styles.orderCard}
                onPress={() =>
                  router.push({ pathname: '/chef/order/[id]', params: { id: item.id } })
                }
              >
                <View style={styles.orderCardHeader}>
                  <Text style={styles.orderNr}>Nr. {item.orderNr}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                    <Text style={styles.statusBadgeText}>{getStatusText(item.status)}</Text>
                  </View>
                </View>
                <Text style={styles.route}>
                  {(item.loadingCompany || '—')} → {(item.unloadingCompany || '—')}
                </Text>
                {item.loadingDate ? (
                  <Text style={styles.date}>
                    {t('chefOrdersList', 'loadingOn')} {isoToGerman(item.loadingDate)}
                  </Text>
                ) : null}
                {item.assignedTo ? (
                  <Text style={styles.assignedDriver}>
                    {t('chefDashboard', 'assignedTo')}: {drivers.find((d) => d.id === item.assignedTo)?.username || t('common', 'unknown')}
                  </Text>
                ) : (
                  <FluidPressable style={styles.assignButton} onPress={() => openAssignModal(item)}>
                    <Text style={styles.assignButtonText}>{t('chefDashboard', 'assignButton')}</Text>
                  </FluidPressable>
                )}
              </FluidPressable>
            )}
          />
        )}
      </View>

      <Modal
        visible={showAssignModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAssignModal(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurSurface
            intensity={30}
            tint="dark"
            fallbackColor="rgba(0,0,0,0.6)"
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('chefDashboard', 'modalTitle')}</Text>
              <FluidPressable onPress={() => setShowAssignModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </FluidPressable>
            </View>

            {selectedOrder && (
              <>
                <Text style={styles.orderInfoTitle}>Nr. {selectedOrder.orderNr}</Text>
                <Text style={styles.orderInfo}>
                  {(selectedOrder.loadingCompany || '—')} → {(selectedOrder.unloadingCompany || '—')}
                </Text>

                <Text style={styles.driversTitle}>{t('chefDashboard', 'selectDriver')}</Text>
                {drivers.length === 0 ? (
                  <Text style={styles.noDriversText}>{t('chefDashboard', 'noDriversYet')}</Text>
                ) : (
                  <FlatList
                    scrollEnabled={false}
                    data={drivers}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <FluidPressable
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
                        <Text style={styles.driverName}>{item.username}</Text>
                      </FluidPressable>
                    )}
                  />
                )}

                <View style={styles.modalButtonContainer}>
                  <FluidPressable
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setShowAssignModal(false)}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.cancelButtonText}>{t('common', 'cancel')}</Text>
                  </FluidPressable>

                  <FluidPressable
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
                  </FluidPressable>
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
    backgroundColor: Colors.ui.lightGray,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  backButton: {
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.primary,
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
  loading: {
    marginTop: 32,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 32,
    color: Colors.ui.primary,
  },
  emptyState: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'white',
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
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: Colors.ui.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderNr: {
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
  route: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.charcoal,
    marginBottom: 4,
  },
  date: {
    fontSize: 11,
    color: Colors.ui.darkGray,
    marginBottom: 6,
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
  noDriversText: {
    fontSize: 13,
    color: Colors.ui.darkGray,
    textAlign: 'center',
    paddingVertical: 12,
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
