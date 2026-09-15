import { ActivityIndicator, StyleSheet, ScrollView, View, Text, FlatList } from 'react-native';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { StatusCard } from '@/components/status-card';
import { Colors, Layout, Radius, shadow, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useAuth } from '@/app/context/AuthContext';
import { getOrdersByDriver, Order } from '@/app/services/orderService';
import { useTranslation } from '@/hooks/use-translation';
import { isoToGerman } from '@/lib/dateFormat';
import { formatTimeWindow } from '@/lib/pdfLayout';
import { currentMonth, isInMonth } from '@/lib/month';
import { MonthPicker } from '@/components/MonthPicker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function DriverDashboardScreen() {
  const styles = useThemedStyles(createStyles);
  const { c, columns } = useAppTheme();
  const { user, isLoading, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [assignedOrders, setAssignedOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  // Standardmäßig der laufende Monat; zurückblättern beliebig weit. Der Monat
  // eines Auftrags ist sein Ladedatum, sonst das Entladedatum — wie in der
  // Umsatzliste (app/services/revenueListService.ts).
  const [month, setMonth] = useState(currentMonth);
  const monthOrders = useMemo(
    () =>
      assignedOrders.filter((order) =>
        isInMonth(order.loadingDate || order.unloadingDate, month)
      ),
    [assignedOrders, month]
  );

  // Kacheln wie beim Chef, nur für den gewählten Monat. "Offen" (noch
  // niemandem zugewiesen) gibt es für den Fahrer nicht — ein Auftrag
  // unterwegs zählt noch als zugewiesen. Tippen filtert die Liste darunter.
  const [statusFilter, setStatusFilter] = useState<'assigned' | 'completed' | null>(null);
  const isOpenOrder = (order: Order) =>
    order.status === 'assigned' || order.status === 'in_progress';
  const assignedCount = monthOrders.filter(isOpenOrder).length;
  const completedCount = monthOrders.filter((order) => order.status === 'completed').length;
  const visibleOrders =
    statusFilter === 'assigned'
      ? monthOrders.filter(isOpenOrder)
      : statusFilter === 'completed'
        ? monthOrders.filter((order) => order.status === 'completed')
        : monthOrders;

  const loadDriverOrders = useCallback(async () => {
    if (!user?.id) return;
    setIsLoadingOrders(true);
    try {
      setAssignedOrders(await getOrdersByDriver(user.id));
    } catch {
      setAssignedOrders([]);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

  // Jedes Mal neu laden, wenn das Dashboard wieder aktiv wird — etwa
  // nachdem ein Auftrag im Detail als erledigt markiert wurde.
  useFocusEffect(
    useCallback(() => {
      loadDriverOrders();
    }, [loadDriverOrders])
  );

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
        <ActivityIndicator size="large" color={c.tint} />
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
          <MonthPicker month={month} onChange={setMonth} />

          <View style={styles.statusContainer}>
            <StatusCard
              count={assignedCount}
              label={t('driverDashboard', 'statusAssigned')}
              color={Colors.ui.blue}
              onPress={() => setStatusFilter('assigned')}
            />
            <StatusCard
              count={completedCount}
              label={t('driverDashboard', 'statusCompleted')}
              color={Colors.ui.green}
              onPress={() => setStatusFilter('completed')}
            />
          </View>

          {/* Tippen hebt den Status-Filter auf — wieder alle Aufträge des Monats. */}
          {statusFilter !== null && (
            <FluidPressable style={styles.statusFilterChip} onPress={() => setStatusFilter(null)}>
              <Text style={styles.statusFilterChipText}>
                {`${getStatusText(statusFilter)} ✕`}
              </Text>
            </FluidPressable>
          )}

          <Text style={styles.sectionTitle}>{t('driverDashboard', 'myOrders')} ({visibleOrders.length})</Text>

          {isLoadingOrders ? (
            <ActivityIndicator style={styles.loading} color={c.tint} />
          ) : visibleOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>{t('driverDashboard', 'emptyOrders')}</Text>
              <Text style={styles.emptyStateSubtext}>
                {t('driverDashboard', 'emptyOrdersSub')}
              </Text>
            </View>
          ) : (
            <FlatList
              // Auf Laptop/Desktop als Kartenraster; key erzwingt Neuaufbau beim Spaltenwechsel
              key={`grid-${columns}`}
              numColumns={columns}
              columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
              scrollEnabled={false}
              data={visibleOrders}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <FluidPressable
                  style={styles.orderCard}
                  onPress={() =>
                    router.push({ pathname: '/driver/order/[id]', params: { id: item.id } })
                  }
                >
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
                </FluidPressable>
              )}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c, scheme } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    container: u.screen,
    loadingContainer: {
      ...u.screen,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      flex: 1,
    },
    section: u.column,
    statusContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    statusFilterChip: {
      alignSelf: 'flex-start',
      minHeight: Layout.minTouch,
      justifyContent: 'center',
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      backgroundColor: c.tintFill,
      marginBottom: Spacing.sm,
    },
    statusFilterChipText: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.onTint,
    },
    sectionTitle: {
      ...Typography.title2,
      color: c.text,
      marginBottom: Spacing.md,
    },
    loading: {
      marginTop: Spacing.xl,
    },
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
    orderHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    orderNumber: {
      ...Typography.headline,
      color: c.text,
    },
    statusBadge: u.badge,
    statusBadgeText: u.badgeText,
    locationItem: {
      marginBottom: Spacing.sm,
    },
    locationLabel: {
      ...Typography.caption1,
      fontWeight: '600',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 2,
    },
    locationText: {
      ...Typography.callout,
      fontWeight: '500',
      color: c.text,
    },
    timeText: {
      ...Typography.footnote,
      color: c.textSecondary,
      marginTop: 2,
    },
    metersText: {
      ...Typography.footnote,
      fontWeight: '600',
      color: c.textSecondary,
    },
  });
};
