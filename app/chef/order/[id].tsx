import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Colors } from '@/constants/theme';
import { useTranslation } from '@/hooks/use-translation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Order, orderService } from '../../services/orderService';

export default function ChefOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, language } = useTranslation();
  const timeLocale = language === 'de' ? 'de-DE' : 'en-US';

  const [order, setOrder] = useState<Order | undefined>(undefined);
  const [drivers, setDrivers] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = () => {
    if (id) {
      setOrder(orderService.getOrderById(id));
    }
    setDrivers(orderService.getDrivers());
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

  const handleAssign = (driverId: string) => {
    if (!order) return;
    orderService.assignOrderToDriver(order.id, driverId);
    loadData();
    Alert.alert(
      t('common', 'success'),
      `${t('chefDashboard', 'orderPrefix')} ${order.orderNumber} ${t('chefOrderDetail', 'alertAssignedSuccess')}`
    );
  };

  if (!order) {
    return (
      <View style={styles.container}>
        <Header title="TRANSLOG PRO" subtitle={t('chefOrderDetail', 'headerSubtitle')} code="CH" />
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>{t('chefOrderDetail', 'notFound')}</Text>
        </View>
      </View>
    );
  }

  const assignedDriver = drivers.find(d => d.id === order.assignedTo);

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('chefOrderDetail', 'headerSubtitle')} code="CH" />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <FluidPressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>← {t('chefOrderDetail', 'back')}</Text>
        </FluidPressable>

        <View style={styles.orderHeaderCard}>
          <View style={styles.orderHeaderRow}>
            <Text style={styles.orderNumber}>{order.orderNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
              <Text style={styles.statusBadgeText}>{getStatusText(order.status)}</Text>
            </View>
          </View>
          {order.priority === 'urgent' && (
            <Text style={styles.priorityUrgent}>{t('driverDashboard', 'priorityUrgent')}</Text>
          )}
          {order.priority === 'high' && (
            <Text style={styles.priorityHigh}>{t('driverDashboard', 'priorityHigh')}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('chefOrderDetail', 'customerSection')}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{t('chefOrderDetail', 'nameLabel')}</Text>
            <Text style={styles.value}>{order.customer.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('chefOrderDetail', 'emailLabel')}</Text>
            <Text style={styles.value}>{order.customer.email}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('chefOrderDetail', 'phoneLabel')}</Text>
            <Text style={styles.value}>{order.customer.phone}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('chefOrderDetail', 'pickupSection')}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{t('chefOrderDetail', 'addressLabel')}</Text>
            <Text style={styles.value}>{order.pickupLocation.address}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('chefOrderDetail', 'cityLabel')}</Text>
            <Text style={styles.value}>{order.pickupLocation.city}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('chefOrderDetail', 'zipLabel')}</Text>
            <Text style={styles.value}>{order.pickupLocation.zipCode}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('chefOrderDetail', 'deliverySection')}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{t('chefOrderDetail', 'addressLabel')}</Text>
            <Text style={styles.value}>{order.deliveryLocation.address}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('chefOrderDetail', 'cityLabel')}</Text>
            <Text style={styles.value}>{order.deliveryLocation.city}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('chefOrderDetail', 'zipLabel')}</Text>
            <Text style={styles.value}>{order.deliveryLocation.zipCode}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('chefOrderDetail', 'packageSection')}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{t('chefOrderDetail', 'descriptionLabel')}</Text>
            <Text style={styles.value}>{order.package.description}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('chefOrderDetail', 'weightLabel')}</Text>
            <Text style={styles.value}>{order.package.weight}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('chefOrderDetail', 'volumeLabel')}</Text>
            <Text style={styles.value}>{order.package.volume}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('chefOrderDetail', 'valueLabel')}</Text>
            <Text style={styles.value}>{order.package.value} €</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('chefOrderDetail', 'fragileLabel')}</Text>
            <Text style={styles.value}>
              {order.package.fragile ? t('chefOrderDetail', 'fragileYes') : t('chefOrderDetail', 'fragileNo')}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('chefOrderDetail', 'scheduleSection')}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{t('chefOrderDetail', 'pickupTimeLabel')}</Text>
            <Text style={styles.value}>
              {new Date(order.scheduledPickupTime).toLocaleString(timeLocale)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('chefOrderDetail', 'deliveryTimeLabel')}</Text>
            <Text style={styles.value}>
              {new Date(order.scheduledDeliveryTime).toLocaleString(timeLocale)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('chefOrderDetail', 'driverSection')}</Text>
          {assignedDriver ? (
            <View style={styles.row}>
              <Text style={styles.label}>{t('chefOrderDetail', 'assignedDriverLabel')}</Text>
              <Text style={styles.value}>{assignedDriver.name}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.notAssignedText}>{t('chefOrderDetail', 'notAssigned')}</Text>
              <Text style={styles.selectDriverTitle}>{t('chefOrderDetail', 'selectDriver')}</Text>
              <FlatList
                scrollEnabled={false}
                data={drivers}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <FluidPressable style={styles.driverOption} onPress={() => handleAssign(item.id)}>
                    <Text style={styles.driverName}>{item.name}</Text>
                    <Text
                      style={[
                        styles.driverStatus,
                        item.status === 'online' ? { color: Colors.ui.green } : { color: Colors.ui.darkGray },
                      ]}
                    >
                      {item.status === 'online' ? `● ${t('common', 'online')}` : `● ${t('common', 'offline')}`}
                    </Text>
                  </FluidPressable>
                )}
              />
            </>
          )}
        </View>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.ui.charcoal,
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
  priorityUrgent: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d32f2f',
    marginTop: 8,
  },
  priorityHigh: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.ui.orange,
    marginTop: 8,
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
  driverStatus: {
    fontSize: 11,
    fontWeight: '600',
  },
});
