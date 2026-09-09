import { useAuth } from '@/app/context/AuthContext';
import { Driver, getDrivers } from '@/app/services/driverService';
import {
  assignOrderToDriver,
  getOrderById,
  updateOrder,
  type Order,
  type OrderFields,
} from '@/app/services/orderService';
import { OrderDocuments } from '@/components/OrderDocuments';
import { OwnOrderForm } from '@/components/OwnOrderForm';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Colors } from '@/constants/theme';
import { useTranslation } from '@/hooks/use-translation';
import { timestampToGerman } from '@/lib/dateFormat';
import { showAlert } from '@/lib/alert';
import { exportOwnOrderPdf } from '@/lib/ownOrderExport';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ChefOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { isOfflineMode } = useAuth();

  const [order, setOrder] = useState<Order | undefined | null>(undefined);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    loadOrder();
    loadDrivers();
  }, [id]);

  const loadOrder = () => {
    if (!id) return;
    getOrderById(id)
      .then((found) => setOrder(found ?? null))
      .catch(() => setOrder(null));
  };

  // Real drivers a boss created via Fahrerverwaltung — not the old demo
  // roster, which never matched what actually exists.
  const loadDrivers = async () => {
    if (isOfflineMode) {
      setDrivers([]);
      return;
    }
    try {
      setDrivers(await getDrivers());
    } catch {
      setDrivers([]);
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

  const handleUpdate = async (fields: OrderFields) => {
    if (!id) return;
    const updated = await updateOrder(id, fields);
    const assignedDriver = drivers.find((d) => d.id === updated.assignedTo);

    // Same reasoning as the create screen: keep this right after the click
    // with nothing awaited ahead of it, so web's popup permission holds.
    await exportOwnOrderPdf(updated, assignedDriver?.username);
    router.back();
  };

  const handleAssign = async (driverId: string) => {
    if (!order) return;
    setIsAssigning(true);
    try {
      await assignOrderToDriver(order.id, driverId);
      loadOrder();
      showAlert(
        t('common', 'success'),
        `Nr. ${order.orderNr} ${t('chefOrderDetail', 'alertAssignedSuccess')}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      showAlert(t('common', 'error'), message);
    } finally {
      setIsAssigning(false);
    }
  };

  if (order === undefined) {
    return (
      <View style={styles.container}>
        <Header title="TRANSLOG PRO" subtitle={t('chefOwnOrder', 'editHeaderSubtitle')} code="CH" />
        <ActivityIndicator style={styles.loading} color={Colors.ui.primary} />
      </View>
    );
  }

  if (order === null) {
    return (
      <View style={styles.container}>
        <Header title="TRANSLOG PRO" subtitle={t('chefOwnOrder', 'editHeaderSubtitle')} code="CH" />
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>{t('chefOrderDetail', 'notFound')}</Text>
        </View>
      </View>
    );
  }

  const assignedDriver = drivers.find((d) => d.id === order.assignedTo);

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('chefOwnOrder', 'editHeaderSubtitle')} code="CH" />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <FluidPressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>← {t('chefOrderDetail', 'back')}</Text>
        </FluidPressable>

        <View style={styles.orderHeaderCard}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
            <Text style={styles.statusBadgeText}>{getStatusText(order.status)}</Text>
          </View>
        </View>

        {order.completedAt ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('chefOrderDetail', 'completedSection')}
            </Text>
            <View style={styles.row}>
              <Text style={styles.label}>
                {t('chefOrderDetail', 'completedAtLabel')}
              </Text>
              <Text style={[styles.value, styles.completedValue]}>
                ✓ {timestampToGerman(order.completedAt)}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('chefOrderDetail', 'driverSection')}</Text>
          {assignedDriver ? (
            <View style={styles.row}>
              <Text style={styles.label}>{t('chefOrderDetail', 'assignedDriverLabel')}</Text>
              <Text style={styles.value}>{assignedDriver.username}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.notAssignedText}>{t('chefOrderDetail', 'notAssigned')}</Text>
              <Text style={styles.selectDriverTitle}>{t('chefOrderDetail', 'selectDriver')}</Text>
              {drivers.length === 0 ? (
                <Text style={styles.notAssignedText}>{t('chefOrderDetail', 'noDriversYet')}</Text>
              ) : (
                <FlatList
                  scrollEnabled={false}
                  data={drivers}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <FluidPressable
                      style={styles.driverOption}
                      onPress={() => handleAssign(item.id)}
                      disabled={isAssigning}
                    >
                      <Text style={styles.driverName}>{item.username}</Text>
                    </FluidPressable>
                  )}
                />
              )}
            </>
          )}
        </View>

        {order.status === 'completed' ? (
          <OrderDocuments orderId={order.id} />
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('orderDocuments', 'title')}</Text>
            <Text style={styles.documentsHint}>
              {t('orderDocuments', 'hiddenUntilCompleted')}
            </Text>
          </View>
        )}

        <OwnOrderForm
          initialValues={order}
          submitLabel={t('chefOwnOrder', 'saveButton')}
          onSubmit={handleUpdate}
        />
      </ScrollView>
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
  contentInner: {
    padding: 16,
    paddingBottom: 24,
  },
  backLink: {
    marginBottom: 12,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.primary,
  },
  loading: {
    marginTop: 32,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ui.darkGray,
  },
  orderHeaderCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.ui.charcoal,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  label: {
    fontSize: 13,
    color: Colors.ui.darkGray,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.charcoal,
    flexShrink: 1,
    textAlign: 'right',
  },
  completedValue: {
    color: Colors.ui.green,
  },
  documentsHint: {
    fontSize: 13,
    color: Colors.ui.darkGray,
    lineHeight: 18,
  },
  notAssignedText: {
    fontSize: 13,
    color: Colors.ui.darkGray,
    marginBottom: 12,
  },
  selectDriverTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.ui.charcoal,
    marginBottom: 8,
  },
  driverOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: Colors.ui.lightGray,
  },
  driverName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.charcoal,
  },
});
