import {
  completeMyOrder,
  type ExternalDriverOrder,
  getMyOrder,
} from '@/app/services/externalDriverOrderService';
import { OrderDocuments } from '@/components/OrderDocuments';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert, showConfirm } from '@/lib/alert';
import { isoToGerman } from '@/lib/dateFormat';
import { formatTimeWindow } from '@/lib/pdfLayout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

const EMPTY = '—';

/**
 * Ein Fremdauftrag aus Sicht des fremden Fahrers: Lade- und Entladedaten,
 * Ladung, Hinweise — keine Preise (die liefert get_my_external_orders gar
 * nicht erst). Dazu CMR/Fotos hochladen und den Auftrag abschließen.
 */
export default function ExternalOrderDetailScreen() {
  const styles = useThemedStyles(createStyles);
  const { c } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  // undefined = lädt, null = nicht gefunden (oder nicht zugewiesen, oder
  // Zugang abgelaufen — die Datenbank unterscheidet das bewusst nicht)
  const [order, setOrder] = useState<ExternalDriverOrder | undefined | null>(undefined);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    getMyOrder(id)
      .then((found) => {
        if (!cancelled) setOrder(found ?? null);
      })
      .catch(() => {
        if (!cancelled) setOrder(null);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const isCompleted = order?.status === 'completed';

  const handleComplete = () => {
    if (!order) return;

    showConfirm(
      t('driverOrderDetail', 'completeConfirmTitle'),
      t('externalDriver', 'completeConfirmMessage'),
      async () => {
        setIsCompleting(true);
        try {
          await completeMyOrder(order.id);
          setOrder((await getMyOrder(order.id)) ?? null);
          showAlert(t('common', 'success'), t('driverOrderDetail', 'alertCompleted'));
        } catch (error) {
          const message =
            error instanceof Error ? error.message : t('driverOrderDetail', 'alertCompleteFailed');
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

  const formatDate = (date: string) => (date ? isoToGerman(date) : EMPTY);

  const header = (
    <Header title="TRANSLOG PRO" subtitle={t('driverOrderDetail', 'headerSubtitle')} />
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
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: isCompleted ? Colors.ui.green : Colors.ui.orange },
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {isCompleted
                ? t('externalDriver', 'statusCompleted')
                : t('externalDriver', 'statusPending')}
            </Text>
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
              {renderRow(t('externalDriver', 'loadingNumberLabel'), order.loadingNumber)}
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
          {renderRow(t('externalDriver', 'cargoDescriptionLabel'), order.cargoDescription)}
          {renderRow(t('driverOrderDetail', 'loadingMetersLabel'), order.loadingMeters)}
          {renderRow(t('externalDriver', 'vehicleTypeLabel'), order.vehicleType)}
          {renderRow(t('externalDriver', 'licensePlateLabel'), order.licensePlate)}
          {renderRow(t('externalDriver', 'driverNameLabel'), order.driverName)}
        </View>

        {order.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('externalDriver', 'notesSection')}</Text>
            <Text style={styles.notes}>{order.notes}</Text>
          </View>
        ) : null}

        <OrderDocuments
          orderId={order.id}
          canUpload
          canDelete={!isCompleted}
          note={t('externalDriver', 'documentsNote')}
        />

        {isCompleted ? (
          <Text style={styles.completedNote}>✓ {t('driverOrderDetail', 'alreadyCompleted')}</Text>
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
    notes: {
      ...Typography.body,
      color: c.text,
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
