import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Header } from '@/components/header';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Spacing, Typography } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import { useAuth } from '@/app/context/AuthContext';
import { isoToGerman } from '@/lib/dateFormat';
import { formatAmount } from '@/lib/invoiceTotals';
import {
  type BillableOrder,
  getBillableOrders,
  getInvoiceSummaries,
  type InvoiceSummary,
} from '@/app/services/invoiceService';

type Tab = 'open' | 'created';

/**
 * Rechnungen im Überblick: was noch verrechnet gehört und was schon
 * verrechnet ist. Angelegt und bearbeitet wird eine Rechnung weiterhin im
 * Auftrag (components/InvoiceForm.tsx) — ein Tipp hier öffnet ihn.
 */
export default function InvoicesScreen() {
  const styles = useThemedStyles(createStyles);
  const { c } = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { isOfflineMode } = useAuth();
  const params = useLocalSearchParams<{ tab?: string }>();

  const [tab, setTab] = useState<Tab>(params.tab === 'created' ? 'created' : 'open');
  const [billable, setBillable] = useState<BillableOrder[]>([]);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [open, created] = await Promise.all([getBillableOrders(), getInvoiceSummaries()]);
      setBillable(open);
      setInvoices(created);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Bei jedem Öffnen neu: Wer im Auftrag eine Rechnung anlegt und
  // zurückkommt, soll ihn hier nicht mehr unter "zu verrechnen" sehen.
  useFocusEffect(
    useCallback(() => {
      if (!isOfflineMode) load();
    }, [isOfflineMode, load])
  );

  // Nach Kunde gruppiert: Sammelrechnungen gehen an einen Kunden, so sieht
  // der Chef auf einen Blick, was zusammen auf eine Rechnung passt.
  const groups = useMemo(() => {
    const map = new Map<string, BillableOrder[]>();
    for (const order of billable) {
      const key = order.billingCompany || t('common', 'unknown');
      const list = map.get(key);
      if (list) list.push(order);
      else map.set(key, [order]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [billable, t]);

  const openOrder = (id: string, external: boolean) =>
    router.push(
      external
        ? { pathname: '/chef/external-order/[id]', params: { id } }
        : { pathname: '/chef/order/[id]', params: { id } }
    );

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('invoices', 'headerSubtitle')} code="CH" />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              load();
            }}
          />
        }
      >
        <FluidPressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>

        <View style={styles.tabs}>
          <FluidPressable
            style={[styles.tab, tab === 'open' && styles.tabActive]}
            onPress={() => setTab('open')}
          >
            <Text style={[styles.tabText, tab === 'open' && styles.tabTextActive]}>
              {t('invoices', 'tabOpen')} ({billable.length})
            </Text>
          </FluidPressable>
          <FluidPressable
            style={[styles.tab, tab === 'created' && styles.tabActive]}
            onPress={() => setTab('created')}
          >
            <Text style={[styles.tabText, tab === 'created' && styles.tabTextActive]}>
              {t('invoices', 'tabCreated')} ({invoices.length})
            </Text>
          </FluidPressable>
        </View>

        {isOfflineMode ? (
          <Text style={styles.errorText}>{t('common', 'offlineModeHint')}</Text>
        ) : isLoading ? (
          <ActivityIndicator style={styles.loading} color={c.tint} />
        ) : loadError !== null ? (
          <>
            <Text style={styles.errorText}>{t('invoices', 'loadFailed')}</Text>
            {!!loadError && <Text style={styles.errorDetail}>{loadError}</Text>}
          </>
        ) : tab === 'open' ? (
          groups.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>{t('invoices', 'openEmpty')}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.hint}>{t('invoices', 'openHint')}</Text>
              {groups.map(([company, orders]) => (
                <View key={company} style={styles.card}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupTitle}>{company}</Text>
                    <Text style={styles.groupCount}>
                      {orders.length === 1
                        ? t('invoices', 'orderCountOne')
                        : `${orders.length} ${t('invoices', 'orderCountMany')}`}
                    </Text>
                  </View>
                  {orders.map((order) => (
                    <FluidPressable
                      key={order.id}
                      style={styles.row}
                      onPress={() => openOrder(order.id, order.external)}
                    >
                      <View style={styles.rowMain}>
                        <Text style={styles.rowTitle}>
                          Nr. {order.orderNr}
                          {order.external ? ` · ${t('invoices', 'externalBadge')}` : ''}
                        </Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {order.loadingCompany || '—'} → {order.unloadingCompany || '—'}
                        </Text>
                      </View>
                      <Text style={styles.rowDate}>
                        {order.date ? isoToGerman(order.date) : '—'}
                      </Text>
                    </FluidPressable>
                  ))}
                </View>
              ))}
            </>
          )
        ) : invoices.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{t('invoices', 'createdEmpty')}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {invoices.map((invoice, index) => (
              <FluidPressable
                key={invoice.id}
                style={[styles.row, index === 0 && styles.rowFirst]}
                disabled={!invoice.firstOrder}
                onPress={() =>
                  invoice.firstOrder &&
                  openOrder(invoice.firstOrder.id, invoice.firstOrder.external)
                }
              >
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>
                    {invoice.belegnummer
                      ? `${t('invoices', 'numberPrefix')} ${invoice.belegnummer}`
                      : t('invoices', 'noNumber')}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {invoice.empfaengerName || '—'} ·{' '}
                    {invoice.itemCount === 1
                      ? t('invoices', 'orderCountOne')
                      : `${invoice.itemCount} ${t('invoices', 'orderCountMany')}`}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.amount}>
                    {invoice.total !== null ? `€ ${formatAmount(invoice.total)}` : '—'}
                  </Text>
                  <Text style={styles.rowDate}>
                    {invoice.rechnungsdatum ? isoToGerman(invoice.rechnungsdatum) : '—'}
                  </Text>
                </View>
              </FluidPressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    container: u.screen,
    content: u.column,
    backButton: u.backButton,
    backButtonText: u.backButtonText,
    tabs: {
      ...u.segmented,
      marginBottom: Spacing.md,
    },
    tab: u.segment,
    tabActive: u.segmentActive,
    tabText: u.segmentText,
    tabTextActive: u.segmentTextActive,
    hint: {
      ...u.hint,
      marginBottom: Spacing.md,
    },
    loading: {
      marginTop: Spacing.xl,
    },
    errorText: {
      ...Typography.subhead,
      color: c.danger,
      textAlign: 'center',
      marginTop: Spacing.lg,
    },
    errorDetail: {
      ...Typography.footnote,
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: Spacing.xs,
    },
    emptyState: {
      ...u.card,
      alignItems: 'center',
      paddingVertical: Spacing.xl,
    },
    emptyStateText: {
      ...Typography.headline,
      color: c.textSecondary,
      textAlign: 'center',
    },
    card: {
      ...u.card,
      marginBottom: Spacing.md,
    },
    groupHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: Spacing.sm,
      marginBottom: Spacing.xxs,
    },
    groupTitle: {
      ...Typography.headline,
      color: c.text,
      flexShrink: 1,
    },
    groupCount: {
      ...Typography.footnote,
      fontWeight: '600',
      color: c.textSecondary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.separator,
    },
    rowFirst: {
      borderTopWidth: 0,
    },
    rowMain: {
      flex: 1,
      minWidth: 0,
    },
    rowTitle: {
      ...Typography.subhead,
      fontWeight: '700',
      color: c.text,
    },
    rowSub: {
      ...Typography.footnote,
      color: c.textSecondary,
      marginTop: 2,
    },
    rowRight: {
      alignItems: 'flex-end',
    },
    amount: {
      ...Typography.subhead,
      fontWeight: '700',
      color: c.text,
      fontVariant: ['tabular-nums'],
    },
    rowDate: {
      ...Typography.footnote,
      color: c.textSecondary,
      fontVariant: ['tabular-nums'],
    },
  });
};
