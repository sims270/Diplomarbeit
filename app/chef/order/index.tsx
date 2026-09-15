import { useAuth } from '@/app/context/AuthContext';
import { Driver, getDrivers } from '@/app/services/driverService';
import { assignOrderToDriver, getAllOrders, type Order } from '@/app/services/orderService';
import { BlurSurface } from '@/components/fluid/BlurSurface';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Colors, Layout, shadow, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert } from '@/lib/alert';
import { isoToGerman, timestampToGermanDate } from '@/lib/dateFormat';
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
  const styles = useThemedStyles(createStyles);
  const { c, columns } = useAppTheme();
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
          <ActivityIndicator style={styles.loading} color={c.tint} />
        ) : loadError ? (
          <Text style={styles.errorText}>{t('chefOrdersList', 'loadFailed')}</Text>
        ) : orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{t('chefOrdersList', 'emptyState')}</Text>
            <Text style={styles.emptyStateSubtext}>{t('chefOrdersList', 'emptyStateSub')}</Text>
          </View>
        ) : (
          <FlatList
            // Auf Laptop/Desktop als Kartenraster; key erzwingt Neuaufbau beim Spaltenwechsel
            key={`grid-${columns}`}
            numColumns={columns}
            columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
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
                {item.completedAt ? (
                  <Text style={styles.completedAt}>
                    ✓ {t('chefOrdersList', 'completedOn')} {timestampToGermanDate(item.completedAt)}
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

const createStyles = (theme: AppTheme) => {
  const { c, scheme } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    container: u.screen,
    content: {
      ...u.column,
      flex: 1,
    },
    backButton: u.backButton,
    backButtonText: u.backButtonText,
    sectionHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    sectionTitle: {
      ...Typography.title2,
      color: c.text,
      flexShrink: 1,
    },
    addButton: u.smallButton,
    addButtonText: u.smallButtonText,
    loading: {
      marginTop: Spacing.xl,
    },
    errorText: u.errorText,
    emptyState: u.emptyState,
    emptyStateText: u.emptyStateText,
    emptyStateSubtext: u.emptyStateSubtext,
    gridRow: u.gridRow,
    orderCard: {
      ...u.gridItem,
      ...u.card,
      marginBottom: Spacing.sm,
      borderLeftWidth: 4,
      borderLeftColor: c.tintFill,
      ...shadow(2, scheme),
    },
    orderCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.xs,
      marginBottom: Spacing.xs,
    },
    orderNr: {
      ...Typography.headline,
      color: c.text,
    },
    statusBadge: u.badge,
    statusBadgeText: u.badgeText,
    route: {
      ...Typography.callout,
      fontWeight: '600',
      color: c.text,
      marginBottom: Spacing.xxs,
    },
    date: {
      ...Typography.footnote,
      color: c.textSecondary,
      marginBottom: Spacing.xs,
    },
    completedAt: {
      ...Typography.footnote,
      color: c.success,
      fontWeight: '600',
      marginBottom: Spacing.xs,
    },
    assignedDriver: {
      ...Typography.footnote,
      color: c.text,
      fontWeight: '600',
    },
    assignButton: {
      ...u.tintedButton,
      minHeight: Layout.minTouch,
      marginTop: Spacing.xs,
    },
    assignButtonText: {
      ...u.tintedButtonText,
      ...Typography.subhead,
      fontWeight: '600',
    },
    modalOverlay: u.modalOverlay,
    modalContent: u.modalSheet,
    modalHeader: {
      ...u.modalHeader,
      marginBottom: Spacing.lg,
    },
    modalTitle: u.modalTitle,
    closeButton: u.closeButton,
    orderInfoTitle: {
      ...Typography.headline,
      color: c.text,
      marginBottom: Spacing.xxs,
    },
    orderInfo: {
      ...Typography.footnote,
      color: c.textSecondary,
      marginBottom: Spacing.xxs,
    },
    driversTitle: {
      ...u.sectionTitle,
      marginTop: Spacing.lg,
    },
    noDriversText: {
      ...u.emptyStateSubtext,
      paddingVertical: Spacing.sm,
    },
    driverOption: {
      ...u.option,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    driverOptionSelected: {
      backgroundColor: c.tintSoft,
      borderColor: c.tint,
    },
    driverRadio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: c.textTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.sm,
    },
    driverRadioSelected: {
      borderColor: c.tint,
    },
    driverRadioMark: {
      color: c.tint,
      fontSize: 12,
      lineHeight: 14,
    },
    driverName: {
      ...u.optionText,
      flex: 1,
    },
    modalButtonContainer: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.lg,
    },
    modalButton: {
      ...u.primaryButton,
      flex: 1,
      paddingHorizontal: Spacing.sm,
    },
    cancelButton: {
      backgroundColor: c.surfaceSecondary,
    },
    cancelButtonText: u.secondaryButtonText,
    submitButton: {
      backgroundColor: c.tintFill,
    },
    submitButtonDisabled: u.disabled,
    submitButtonText: u.primaryButtonText,
  });
};
