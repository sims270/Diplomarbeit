import { useAuth } from '@/app/context/AuthContext';
import {
  type ExternalDriverOrder,
  getMyAccess,
  getMyOrders,
  type MyExternalAccess,
} from '@/app/services/externalDriverOrderService';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Colors, shadow, Spacing, Typography } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import { isoToGerman } from '@/lib/dateFormat';
import { formatTimeWindow } from '@/lib/pdfLayout';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'noAccess' }
  | { kind: 'ready'; access: MyExternalAccess; orders: ExternalDriverOrder[] };

export default function ExternalDriverHomeScreen() {
  const styles = useThemedStyles(createStyles);
  const { c } = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { isLoading, isAuthenticated, logout } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

  const load = useCallback(async () => {
    try {
      const access = await getMyAccess();
      if (!access) {
        setState({ kind: 'noAccess' });
        return;
      }
      // Abgelaufen: Die Datenbank gibt ohnehin keine Aufträge mehr heraus.
      const orders = access.isActive ? await getMyOrders() : [];
      setState({ kind: 'ready', access, orders });
    } catch {
      setState({ kind: 'error' });
    }
  }, []);

  // Auf Fokus, damit ein eben abgeschlossener Auftrag nach unten rutscht.
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) load();
    }, [isAuthenticated, load])
  );

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const formatDateTime = (date: string, from: string, until: string) => {
    if (!date) return '—';
    const window = formatTimeWindow(from, until);
    return window ? `${isoToGerman(date)}, ${window}` : isoToGerman(date);
  };

  const renderOrder = (order: ExternalDriverOrder) => {
    const isCompleted = order.status === 'completed';
    return (
      <FluidPressable
        key={order.id}
        style={styles.orderCard}
        onPress={() => router.push({ pathname: '/external/order/[id]', params: { id: order.id } })}
      >
        <View style={styles.orderHeader}>
          <Text style={styles.orderNumber}>Nr. {order.orderNr}</Text>
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

        <View style={styles.locationItem}>
          <Text style={styles.locationLabel}>{t('driverDashboard', 'pickup')}:</Text>
          <Text style={styles.locationText}>
            {order.loadingCompany || '—'}
            {order.loadingAddress ? `, ${order.loadingAddress}` : ''}
          </Text>
          <Text style={styles.timeText}>
            {formatDateTime(order.loadingDate, order.loadingTimeFrom, order.loadingTimeUntil)}
          </Text>
        </View>

        <View style={styles.locationItem}>
          <Text style={styles.locationLabel}>{t('driverDashboard', 'delivery')}:</Text>
          <Text style={styles.locationText}>
            {order.unloadingCompany || '—'}
            {order.unloadingAddress ? `, ${order.unloadingAddress}` : ''}
          </Text>
          <Text style={styles.timeText}>
            {formatDateTime(order.unloadingDate, order.unloadingTimeFrom, order.unloadingTimeUntil)}
          </Text>
        </View>
      </FluidPressable>
    );
  };

  const renderContent = () => {
    if (state.kind === 'loading') {
      return <ActivityIndicator style={styles.loading} color={c.tint} />;
    }

    if (state.kind === 'error') {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>{t('externalDriver', 'loadFailed')}</Text>
        </View>
      );
    }

    if (state.kind === 'noAccess' || !state.access.isActive) {
      return (
        <View style={styles.emptyState}>
          {state.kind === 'ready' ? (
            <>
              <Text style={styles.emptyStateText}>{t('externalDriver', 'expiredTitle')}</Text>
              <Text style={styles.emptyStateSubtext}>{t('externalDriver', 'expiredText')}</Text>
            </>
          ) : (
            <Text style={styles.emptyStateSubtext}>{t('externalDriver', 'noAccessText')}</Text>
          )}
          <FluidPressable style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>{t('externalDriver', 'logoutButton')}</Text>
          </FluidPressable>
        </View>
      );
    }

    const open = state.orders.filter((order) => order.status !== 'completed');
    const completed = state.orders.filter((order) => order.status === 'completed');

    return (
      <>
        <Text style={styles.accessInfo}>
          {state.access.label ? `${state.access.label} · ` : ''}
          {t('externalDriver', 'validUntil')} {isoToGerman(state.access.expiresOn)}
        </Text>

        {state.orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{t('externalDriver', 'emptyOrders')}</Text>
            <Text style={styles.emptyStateSubtext}>{t('externalDriver', 'emptyOrdersSub')}</Text>
          </View>
        ) : (
          <>
            {open.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>
                  {t('externalDriver', 'openSection')} ({open.length})
                </Text>
                {open.map(renderOrder)}
              </>
            )}
            {completed.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>
                  {t('externalDriver', 'completedSection')} ({completed.length})
                </Text>
                {completed.map(renderOrder)}
              </>
            )}
          </>
        )}
      </>
    );
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
      <Header title="TRANSLOG PRO" subtitle={t('externalDriver', 'headerSubtitle')} />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>{renderContent()}</View>
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
    loading: {
      marginTop: Spacing.xl,
    },
    accessInfo: {
      ...Typography.subhead,
      color: c.textSecondary,
      marginBottom: Spacing.md,
    },
    sectionTitle: {
      ...Typography.title2,
      color: c.text,
      marginTop: Spacing.sm,
      marginBottom: Spacing.md,
    },
    emptyState: u.emptyState,
    emptyStateText: u.emptyStateText,
    emptyStateSubtext: u.emptyStateSubtext,
    orderCard: {
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
    logoutButton: {
      ...u.secondaryButton,
      marginTop: Spacing.lg,
      alignSelf: 'stretch',
    },
    logoutButtonText: u.secondaryButtonText,
  });
};
