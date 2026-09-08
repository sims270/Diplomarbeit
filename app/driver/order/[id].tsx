import { useAuth } from '@/app/context/AuthContext';
import { completeOrder, getOrderById, type Order } from '@/app/services/orderService';
import { OrderDocuments } from '@/components/OrderDocuments';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Colors } from '@/constants/theme';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert, showConfirm } from '@/lib/alert';
import { isoToGerman, timestampToGerman } from '@/lib/dateFormat';
import { formatTimeWindow } from '@/lib/pdfLayout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

const EMPTY = '—';

export default function DriverOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();

  // undefined = still loading, null = not found (or not this driver's order)
  const [order, setOrder] = useState<Order | undefined | null>(undefined);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    getOrderById(id)
      .then((found) => {
        if (cancelled) return;
        // A driver may only open orders assigned to them — the id comes
        // straight from the URL, so it can't be trusted on its own.
        setOrder(found && found.assignedTo === user?.id ? found : null);
      })
      .catch(() => {
        if (!cancelled) setOrder(null);
      });

    return () => {
      cancelled = true;
    };
  }, [id, user?.id]);

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

  const formatDate = (date: string) => (date ? isoToGerman(date) : EMPTY);

  const formatTimestamp = (timestamp: string) =>
    timestamp ? timestampToGerman(timestamp) : EMPTY;

  const handleComplete = () => {
    if (!order) return;

    showConfirm(
      t('driverOrderDetail', 'completeConfirmTitle'),
      t('driverOrderDetail', 'completeConfirmMessage'),
      async () => {
        setIsCompleting(true);
        try {
          setOrder(await completeOrder(order.id));
          showAlert(t('common', 'success'), t('driverOrderDetail', 'alertCompleted'));
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : t('driverOrderDetail', 'alertCompleteFailed');
          showAlert(t('common', 'error'), message);
        } finally {
          setIsCompleting(false);
        }
      },
      {
        confirmText: t('driverOrderDetail', 'completeConfirmConfirm'),
        cancelText: t('driverOrderDetail', 'completeConfirmCancel'),
      }
    );
  };

  const renderRow = (label: string, value: string) => (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || EMPTY}</Text>
    </View>
  );

  const header = (
    <Header
      title="TRANSLOG PRO"
      subtitle={t('driverOrderDetail', 'headerSubtitle')}
      code={user?.username?.[0]?.toUpperCase() || 'U'}
    />
  );

  if (order === undefined) {
    return (
      <View style={styles.container}>
        {header}
        <ActivityIndicator style={styles.loading} color={Colors.ui.primary} />
      </View>
    );
  }

  if (order === null) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>{t('driverOrderDetail', 'notFound')}</Text>
          <FluidPressable style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>← {t('driverOrderDetail', 'back')}</Text>
          </FluidPressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <FluidPressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>← {t('driverOrderDetail', 'back')}</Text>
        </FluidPressable>

        <View style={styles.orderHeaderCard}>
          <View>
            <Text style={styles.orderNumberLabel}>{t('driverOrderDetail', 'orderNumber')}</Text>
            <Text style={styles.orderNumber}>Nr. {order.orderNr}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
            <Text style={styles.statusBadgeText}>{getStatusText(order.status)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('driverOrderDetail', 'pickupSection')}</Text>
          {renderRow(t('driverOrderDetail', 'companyLabel'), order.loadingCompany)}
          {renderRow(t('driverOrderDetail', 'addressLabel'), order.loadingAddress)}
          {renderRow(t('driverOrderDetail', 'dateLabel'), formatDate(order.loadingDate))}
          {renderRow(
            t('driverOrderDetail', 'timeLabel'),
            formatTimeWindow(order.loadingTimeFrom, order.loadingTimeUntil)
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('driverOrderDetail', 'deliverySection')}</Text>
          {renderRow(t('driverOrderDetail', 'companyLabel'), order.unloadingCompany)}
          {renderRow(t('driverOrderDetail', 'addressLabel'), order.unloadingAddress)}
          {renderRow(t('driverOrderDetail', 'dateLabel'), formatDate(order.unloadingDate))}
          {renderRow(
            t('driverOrderDetail', 'timeLabel'),
            formatTimeWindow(order.unloadingTimeFrom, order.unloadingTimeUntil)
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('driverOrderDetail', 'cargoSection')}</Text>
          {renderRow(t('driverOrderDetail', 'loadingMetersLabel'), order.loadingMeters)}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('driverOrderDetail', 'infoSection')}</Text>
          {renderRow(t('driverOrderDetail', 'createdAtLabel'), formatTimestamp(order.createdAt))}
          {renderRow(t('driverOrderDetail', 'updatedAtLabel'), formatTimestamp(order.updatedAt))}
          {order.completedAt
            ? renderRow(
                t('driverOrderDetail', 'completedAtLabel'),
                formatTimestamp(order.completedAt)
              )
            : null}
        </View>

        <OrderDocuments
          orderId={order.id}
          canUpload
          canDelete={order.status !== 'completed'}
          note={t('orderDocuments', 'visibleAfterCompletion')}
        />

        {order.status === 'completed' ? (
          <Text style={styles.completedNote}>
            ✓ {t('driverOrderDetail', 'alreadyCompleted')}
          </Text>
        ) : (
          <FluidPressable
            style={[styles.completeButton, isCompleting && styles.completeButtonDisabled]}
            onPress={handleComplete}
            disabled={isCompleting}
          >
            {isCompleting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.completeButtonText}>
                {t('driverOrderDetail', 'completeButton')}
              </Text>
            )}
          </FluidPressable>
        )}
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
    paddingBottom: 32,
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
    marginBottom: 12,
  },
  backLink: {
    marginBottom: 12,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.primary,
  },
  orderHeaderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  orderNumberLabel: {
    fontSize: 11,
    color: Colors.ui.darkGray,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
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
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 16,
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
  completeButton: {
    backgroundColor: Colors.ui.green,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  completeButtonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  completedNote: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.green,
    paddingVertical: 8,
  },
});
