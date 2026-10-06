import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import { dateToIso } from '@/lib/dateFormat';
import type { Order } from '@/app/services/orderService';
import type { Driver } from '@/app/services/driverService';

interface TodayOrdersProps {
  orders: Order[];
  drivers: Driver[];
}

interface Appointment {
  order: Order;
  /** Heute laden, entladen oder beides. */
  loading: boolean;
  unloading: boolean;
  /** "08:00–10:00"; leer, wenn keine Uhrzeit eingetragen ist. */
  time: string;
}

function timeRange(from: string, until: string): string {
  if (from && until) return `${from}–${until}`;
  return from || until;
}

/**
 * Die eigenen Aufträge, die heute geladen oder entladen werden — damit der
 * Chef beim Öffnen des Dashboards sofort sieht, was heute läuft.
 * Stornierte zählen nicht. Sortiert nach Uhrzeit, ohne Uhrzeit ans Ende.
 */
export function TodayOrders({ orders, drivers }: TodayOrdersProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const router = useRouter();

  const appointments = useMemo<Appointment[]>(() => {
    const today = dateToIso(new Date());
    return orders
      .filter((o) => o.status !== 'cancelled')
      .filter((o) => o.loadingDate === today || o.unloadingDate === today)
      .map((order) => {
        const loading = order.loadingDate === today;
        const unloading = order.unloadingDate === today;
        // Wird heute geladen, zählt die Ladezeit — sie kommt zuerst.
        const time = loading
          ? timeRange(order.loadingTimeFrom, order.loadingTimeUntil)
          : timeRange(order.unloadingTimeFrom, order.unloadingTimeUntil);
        return { order, loading, unloading, time };
      })
      .sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  }, [orders]);

  const statusInfo = (status: string): { color: string; label: string } => {
    switch (status) {
      case 'pending':
        return { color: Colors.ui.orange, label: t('chefDashboard', 'statusOpen') };
      case 'assigned':
        return { color: Colors.ui.blue, label: t('chefDashboard', 'statusAssigned') };
      case 'in_progress':
        return { color: Colors.ui.blue, label: t('chefDashboard', 'statusInProgress') };
      case 'completed':
        return { color: Colors.ui.green, label: t('chefDashboard', 'statusCompleted') };
      default:
        return { color: Colors.ui.darkGray, label: status };
    }
  };

  if (appointments.length === 0) {
    return <Text style={styles.empty}>{t('chefDashboard', 'todayEmpty')}</Text>;
  }

  return (
    <View style={styles.list}>
      {appointments.map(({ order, loading, unloading, time }) => {
        const status = statusInfo(order.status);
        const driver = order.assignedTo
          ? drivers.find((d) => d.id === order.assignedTo)?.username ?? t('common', 'unknown')
          : t('chefDashboard', 'todayUnassigned');
        const kind = [
          loading && t('chefDashboard', 'todayLoading'),
          unloading && t('chefDashboard', 'todayUnloading'),
        ]
          .filter(Boolean)
          .join(' + ');

        return (
          <FluidPressable
            key={order.id}
            style={[styles.row, { borderLeftColor: status.color }]}
            onPress={() => router.push({ pathname: '/chef/order/[id]', params: { id: order.id } })}
          >
            <View style={styles.timeColumn}>
              <Text style={styles.time}>{time || '—'}</Text>
              <Text style={styles.kind}>{kind}</Text>
            </View>
            <View style={styles.details}>
              <Text style={styles.route} numberOfLines={1}>
                {order.loadingCompany || '—'} → {order.unloadingCompany || '—'}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                Nr. {order.orderNr} · {driver}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
              <Text style={styles.statusText}>{status.label}</Text>
            </View>
          </FluidPressable>
        );
      })}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    list: {
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    empty: {
      ...u.hint,
      marginTop: Spacing.md,
    },
    row: {
      ...u.card,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      borderLeftWidth: 4,
    },
    timeColumn: {
      minWidth: 92,
    },
    time: {
      ...Typography.headline,
      color: c.text,
      fontVariant: ['tabular-nums'],
    },
    kind: {
      ...Typography.caption1,
      fontWeight: '600',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginTop: 2,
    },
    details: {
      flex: 1,
      minWidth: 0,
    },
    route: {
      ...Typography.subhead,
      fontWeight: '700',
      color: c.text,
    },
    meta: {
      ...Typography.footnote,
      color: c.textSecondary,
      marginTop: 2,
    },
    statusBadge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 3,
      borderRadius: Radius.pill,
    },
    statusText: {
      ...Typography.caption1,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
};
