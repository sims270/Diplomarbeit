import { useAuth } from '@/app/context/AuthContext';
import { completeOrder, getOrderById, type Order } from '@/app/services/orderService';
import { OrderDocuments } from '@/components/OrderDocuments';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert, showConfirm } from '@/lib/alert';
import { isoToGerman, timestampToGerman } from '@/lib/dateFormat';
import { formatTimeWindow } from '@/lib/pdfLayout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const EMPTY = '—';

export default function DriverOrderDetailScreen() {
  const styles = useThemedStyles(createStyles);
  const { c, scheme } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();

  // undefined = still loading, null = not found (or not this driver's order)
  const [order, setOrder] = useState<Order | undefined | null>(undefined);
  const [isCompleting, setIsCompleting] = useState(false);
  const [emptyKm, setEmptyKm] = useState('');
  const [freightKm, setFreightKm] = useState('');

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

    // Beim Beilader lassen sich der einzelnen Ladung keine Kilometer
    // zuordnen — dort wird gar nicht erst danach gefragt, und es geht
    // nichts zu prüfen. Bei einer Komplettladung sind beide Pflicht; die
    // Datenbank besteht darauf ebenfalls (complete_order), das hier ist
    // die freundliche Fassung derselben Regel.
    let km: { emptyKm: number | null; freightKm: number | null } = {
      emptyKm: null,
      freightKm: null,
    };

    if (order.cargoType === 'komplett') {
      const leer = emptyKm.trim();
      const fracht = freightKm.trim();

      if (!leer || !fracht) {
        showAlert(t('common', 'error'), t('driverOrderDetail', 'alertKmRequired'));
        return;
      }

      const leerZahl = Number(leer);
      const frachtZahl = Number(fracht);
      if (
        !Number.isInteger(leerZahl) || leerZahl < 0 ||
        !Number.isInteger(frachtZahl) || frachtZahl < 0
      ) {
        showAlert(t('common', 'error'), t('driverOrderDetail', 'alertKmInvalid'));
        return;
      }

      km = { emptyKm: leerZahl, freightKm: frachtZahl };
    }

    showConfirm(
      t('driverOrderDetail', 'completeConfirmTitle'),
      t('driverOrderDetail', 'completeConfirmMessage'),
      async () => {
        setIsCompleting(true);
        try {
          setOrder(await completeOrder(order.id, km));
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
        <ActivityIndicator style={styles.loading} color={c.tint} />
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

        {/* Laptop/Desktop: zwei Spalten nebeneinander */}
        <View style={styles.pair}>
          <View style={styles.pairItem}>
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

          </View>
          <View style={styles.pairItem}>
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

          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('driverOrderDetail', 'cargoSection')}</Text>
          {renderRow(t('driverOrderDetail', 'loadingMetersLabel'), order.loadingMeters)}
          {renderRow(
            t('driverOrderDetail', 'cargoTypeLabel'),
            t(
              'driverOrderDetail',
              order.cargoType === 'beilader' ? 'cargoTypeBeilader' : 'cargoTypeKomplett'
            )
          )}
        </View>

        {/* Kilometer: bei einer Komplettladung vor dem Abschließen
            einzutragen, danach nur noch zum Nachlesen. Beim Beilader
            steht hier nur, warum nichts abgefragt wird. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('driverOrderDetail', 'kmSection')}</Text>

          {order.cargoType === 'beilader' ? (
            <Text style={styles.kmNote}>{t('driverOrderDetail', 'kmBeilader')}</Text>
          ) : order.status === 'completed' ? (
            <>
              {renderRow(
                t('driverOrderDetail', 'emptyKmLabel'),
                order.emptyKm === null ? '' : `${order.emptyKm.toLocaleString('de-DE')} km`
              )}
              {renderRow(
                t('driverOrderDetail', 'freightKmLabel'),
                order.freightKm === null ? '' : `${order.freightKm.toLocaleString('de-DE')} km`
              )}
            </>
          ) : (
            <>
              <Text style={styles.kmLabel}>{t('driverOrderDetail', 'emptyKmLabel')}</Text>
              <TextInput
                placeholderTextColor={c.placeholder}
                keyboardAppearance={scheme}
                style={styles.kmInput}
                value={emptyKm}
                onChangeText={setEmptyKm}
                placeholder={t('driverOrderDetail', 'emptyKmPlaceholder')}
                keyboardType="numeric"
                editable={!isCompleting}
              />

              <Text style={styles.kmLabel}>{t('driverOrderDetail', 'freightKmLabel')}</Text>
              <TextInput
                placeholderTextColor={c.placeholder}
                keyboardAppearance={scheme}
                style={styles.kmInput}
                value={freightKm}
                onChangeText={setFreightKm}
                placeholder={t('driverOrderDetail', 'freightKmPlaceholder')}
                keyboardType="numeric"
                editable={!isCompleting}
              />

              <Text style={styles.kmNote}>{t('driverOrderDetail', 'kmHint')}</Text>
            </>
          )}
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

const createStyles = (theme: AppTheme) => {
  const { c } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    pair: u.pair,
    pairItem: u.pairItem,
    container: u.screen,
    content: {
      flex: 1,
    },
    contentInner: u.formColumn,
    loading: {
      marginTop: Spacing.xl,
    },
    backLink: u.backButton,
    backLinkText: u.backButtonText,
    orderHeaderCard: {
      ...u.card,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    orderNumberLabel: {
      ...Typography.caption1,
      fontWeight: '600',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 2,
    },
    orderNumber: {
      ...Typography.title2,
      color: c.text,
    },
    statusBadge: {
      ...u.badge,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xxs + 1,
    },
    statusBadgeText: u.badgeText,
    section: {
      ...u.card,
      marginBottom: Spacing.md,
    },
    sectionTitle: {
      ...Typography.title3,
      color: c.text,
      marginBottom: Spacing.xs,
    },
    // iOS-Listenzeile: Bezeichnung links, Wert rechts, Haarlinie dazwischen
    row: {
      minHeight: Layout.minTouch,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
      gap: Spacing.md,
    },
    label: {
      ...Typography.subhead,
      color: c.textSecondary,
    },
    value: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.text,
      flexShrink: 1,
      textAlign: 'right',
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    emptyStateText: {
      ...u.emptyStateText,
      marginBottom: Spacing.sm,
    },
    kmLabel: {
      ...Typography.caption1,
      fontWeight: '600',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: Spacing.xs - 2,
      marginTop: Spacing.xs,
    },
    kmInput: {
      ...u.input,
      backgroundColor: c.surfaceSecondary,
      borderColor: 'transparent',
    },
    kmNote: {
      ...u.hint,
      marginTop: 0,
    },
    completeButton: {
      ...u.primaryButton,
      minHeight: 56,
    },
    completeButtonDisabled: u.disabled,
    completeButtonText: u.primaryButtonText,
    completedNote: {
      ...Typography.callout,
      textAlign: 'center',
      fontWeight: '600',
      color: c.success,
      paddingVertical: Spacing.xs,
    },
  });
};
