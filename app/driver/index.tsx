import { ActivityIndicator, StyleSheet, ScrollView, View, Text, FlatList } from 'react-native';
import { Header } from '@/components/header';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/app/context/AuthContext';
import { getOrdersByDriver, Order } from '@/app/services/orderService';
import { useTranslation } from '@/hooks/use-translation';
import { isoToGerman } from '@/lib/dateFormat';
import { formatTimeWindow } from '@/lib/pdfLayout';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';

export default function DriverDashboardScreen() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [assignedOrders, setAssignedOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (user?.id) {
      loadDriverOrders();
    }
  }, [isLoading, isAuthenticated, user?.id, router]);

  const loadDriverOrders = async () => {
    if (!user?.id) return;
    setIsLoadingOrders(true);
    try {
      setAssignedOrders(await getOrdersByDriver(user.id));
    } catch {
      setAssignedOrders([]);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned':
        return Colors.ui.orange;
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
      assigned: t('driverDashboard', 'statusAssigned'),
      in_progress: t('driverDashboard', 'statusInProgress'),
      completed: t('driverDashboard', 'statusCompleted'),
      cancelled: t('driverDashboard', 'statusCancelled'),
    };
    return statusMap[status] || status;
  };

  const formatDateTime = (date: string, from: string, until: string) => {
    if (!date) return '—';
    const window = formatTimeWindow(from, until);
    return window ? `${isoToGerman(date)}, ${window}` : isoToGerman(date);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.ui.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Header
        title="TRANSLOG PRO"
        subtitle={`${t('driverDashboard', 'headerSubtitle')} - ${user?.name || t('common', 'unknown')}`}
        code={user?.username?.[0]?.toUpperCase() || 'U'}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('driverDashboard', 'myOrders')} ({assignedOrders.length})</Text>

          {isLoadingOrders ? (
            <ActivityIndicator style={styles.loading} color={Colors.ui.primary} />
          ) : assignedOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>{t('driverDashboard', 'emptyOrders')}</Text>
              <Text style={styles.emptyStateSubtext}>
                {t('driverDashboard', 'emptyOrdersSub')}
              </Text>
            </View>
          ) : (
            <FlatList
              scrollEnabled={false}
              data={assignedOrders}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.orderCard}>
                  <View style={styles.orderHeader}>
                    <Text style={styles.orderNumber}>Nr. {item.orderNr}</Text>
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

                  <View style={styles.locationItem}>
                    <Text style={styles.locationLabel}>{t('driverDashboard', 'pickup')}:</Text>
                    <Text style={styles.locationText}>
                      {item.loadingCompany || '—'}{item.loadingAddress ? `, ${item.loadingAddress}` : ''}
                    </Text>
                    <Text style={styles.timeText}>
                      {formatDateTime(item.loadingDate, item.loadingTimeFrom, item.loadingTimeUntil)}
                    </Text>
                  </View>

                  <View style={styles.locationItem}>
                    <Text style={styles.locationLabel}>{t('driverDashboard', 'delivery')}:</Text>
                    <Text style={styles.locationText}>
                      {item.unloadingCompany || '—'}{item.unloadingAddress ? `, ${item.unloadingAddress}` : ''}
                    </Text>
                    <Text style={styles.timeText}>
                      {formatDateTime(item.unloadingDate, item.unloadingTimeFrom, item.unloadingTimeUntil)}
                    </Text>
                  </View>

                  {item.loadingMeters ? (
                    <Text style={styles.metersText}>
                      {t('driverDashboard', 'loadingMeters')}: {item.loadingMeters}
                    </Text>
                  ) : null}
                </View>
              )}
            />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.ui.lightGray,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  loading: {
    marginTop: 32,
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
  locationItem: {
    marginBottom: 8,
  },
  locationLabel: {
    fontSize: 10,
    color: Colors.ui.darkGray,
    fontWeight: '600',
  },
  locationText: {
    fontSize: 12,
    color: Colors.light.text,
    fontWeight: '500',
  },
  timeText: {
    fontSize: 11,
    color: Colors.ui.darkGray,
  },
  metersText: {
    fontSize: 11,
    color: Colors.ui.darkGray,
    fontWeight: '600',
  },
});
