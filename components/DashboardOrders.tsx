import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import { dateToIso, isoToGerman } from '@/lib/dateFormat';
import { isOrderInPeriod, TODAY_PERIOD } from '@/lib/orderPeriod';
import { type ExternalOrder, externalOrderTileStatus } from '@/app/services/externalOrderService';
import type { Order } from '@/app/services/orderService';
import type { Driver } from '@/app/services/driverService';

// Ein ganzes Jahr kann sehr lang werden. Das Dashboard zeigt die Aufträge
// deshalb in Etappen, statt alle Zeilen auf einmal aufzubauen.
const PAGE_SIZE = 30;

interface DashboardOrdersProps {
  orders: Order[];
  externalOrders: ExternalOrder[];
  drivers: Driver[];
  /** Siehe lib/orderPeriod.ts */
  period: string;
}

interface Row {
  id: string;
  external: boolean;
  orderNr: string;
  route: string;
  status: string;
  assignee: string;
  /** Erste Zeile links: die Uhrzeit (heute) oder das Datum. */
  primary: string;
  /** Zweite Zeile links: Laden/Entladen (heute) oder die Uhrzeit. */
  secondary: string;
  sortDate: string;
  sortTime: string;
}

function timeRange(from: string, until: string): string {
  if (from && until) return `${from}–${until}`;
  return from || until;
}

/**
 * Die Aufträge des gewählten Zeitraums auf dem Dashboard, eigene und
 * Fremdaufträge wie auf den Kacheln darüber. Heute nach Uhrzeit sortiert,
 * sonst die neuesten zuerst. Stornierte zählen nicht.
 */
export function DashboardOrders({ orders, externalOrders, drivers, period }: DashboardOrdersProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const router = useRouter();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const rows = useMemo<Row[]>(() => {
    const isToday = period === TODAY_PERIOD;
    const today = dateToIso(new Date());

    const toRow = (
      order: Order | ExternalOrder,
      external: boolean,
      status: string,
      assignee: string
    ): Row => {
      const loading = order.loadingDate === today;
      const unloading = order.unloadingDate === today;
      const usesUnloading = isToday ? !loading : !order.loadingDate;
      const time = usesUnloading
        ? timeRange(order.unloadingTimeFrom, order.unloadingTimeUntil)
        : timeRange(order.loadingTimeFrom, order.loadingTimeUntil);
      const date = order.loadingDate || order.unloadingDate;
      const kind = [
        loading && t('chefDashboard', 'todayLoading'),
        unloading && t('chefDashboard', 'todayUnloading'),
      ]
        .filter(Boolean)
        .join(' + ');

      return {
        id: order.id,
        external,
        orderNr: order.orderNr,
        route: `${order.loadingCompany || '—'} → ${order.unloadingCompany || '—'}`,
        status,
        assignee,
        primary: isToday ? time || '—' : date ? isoToGerman(date) : '—',
        secondary: isToday ? kind : time,
        sortDate: date,
        sortTime: time,
      };
    };

    const own = orders
      .filter((o) => o.status !== 'cancelled' && isOrderInPeriod(o, period))
      .map((o) =>
        toRow(
          o,
          false,
          o.status,
          o.assignedTo
            ? drivers.find((d) => d.id === o.assignedTo)?.username ?? t('common', 'unknown')
            : t('chefDashboard', 'todayUnassigned')
        )
      );

    const external = externalOrders
      .filter((o) => isOrderInPeriod(o, period))
      .map((o) =>
        toRow(
          o,
          true,
          externalOrderTileStatus(o),
          [t('invoices', 'externalBadge'), o.recipientCompany].filter(Boolean).join(' · ')
        )
      );

    return [...own, ...external].sort((a, b) =>
      isToday
        ? (a.sortTime || '99').localeCompare(b.sortTime || '99')
        : b.sortDate.localeCompare(a.sortDate) || a.sortTime.localeCompare(b.sortTime)
    );
  }, [orders, externalOrders, drivers, period, t]);

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

  if (rows.length === 0) {
    return (
      <Text style={styles.empty}>
        {period === TODAY_PERIOD
          ? t('chefDashboard', 'todayEmpty')
          : t('chefOrdersList', 'emptyPeriod')}
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {rows.slice(0, visibleCount).map((row) => {
        const status = statusInfo(row.status);
        return (
          <FluidPressable
            key={row.id}
            style={[styles.row, { borderLeftColor: status.color }]}
            onPress={() =>
              router.push({
                pathname: row.external ? '/chef/external-order/[id]' : '/chef/order/[id]',
                params: { id: row.id },
              })
            }
          >
            <View style={styles.timeColumn}>
              <Text style={styles.time}>{row.primary}</Text>
              {!!row.secondary && <Text style={styles.kind}>{row.secondary}</Text>}
            </View>
            <View style={styles.details}>
              <Text style={styles.route} numberOfLines={1}>
                {row.route}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                Nr. {row.orderNr} · {row.assignee}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
              <Text style={styles.statusText}>{status.label}</Text>
            </View>
          </FluidPressable>
        );
      })}

      {rows.length > visibleCount && (
        <FluidPressable
          style={styles.moreButton}
          onPress={() => setVisibleCount((count) => count + PAGE_SIZE)}
        >
          <Text style={styles.moreButtonText}>
            {t('chefDashboard', 'showMoreOrders').replace(
              '{count}',
              String(rows.length - visibleCount)
            )}
          </Text>
        </FluidPressable>
      )}
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
    moreButton: u.tintedButton,
    moreButtonText: u.tintedButtonText,
  });
};
