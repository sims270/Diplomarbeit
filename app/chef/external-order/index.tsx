import { type ExternalOrder, getAllExternalOrders } from '@/app/services/externalOrderService';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { OrderPeriodFilter } from '@/components/OrderPeriodFilter';
import { shadow, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useTranslation } from '@/hooks/use-translation';
import { listDrafts } from '@/lib/orderDrafts';
import { matchesSearch, parseSearch } from '@/lib/orderSearch';
import { OrderSearchField } from '@/components/OrderSearchField';
import { isoToGerman } from '@/lib/dateFormat';
import { currentMonth } from '@/lib/month';
import { ALL_PERIOD, isOrderInPeriod } from '@/lib/orderPeriod';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function ExternalOrdersListScreen() {
  const styles = useThemedStyles(createStyles);
  const { c, columns } = useAppTheme();
  const router = useRouter();
  // Anzahl der Entwürfe für den Button neben "Neu" — beim Zurückkommen neu gezählt.
  const [draftCount, setDraftCount] = useState(0);
  useFocusEffect(
    useCallback(() => {
      listDrafts().then((drafts) => setDraftCount(drafts.filter((d) => d.kind === 'external').length));
    }, [])
  );
  const { t } = useTranslation();
  const [orders, setOrders] = useState<ExternalOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // Wie bei den eigenen Aufträgen: standardmäßig der laufende Monat.
  const [period, setPeriod] = useState(currentMonth);

  // Suche: durchsucht alle Zeiträume, solange etwas im Feld steht.
  const [search, setSearch] = useState('');
  const searchWords = useMemo(() => parseSearch(search), [search]);
  const isSearching = searchWords.length > 0;

  const visibleOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          (isSearching || isOrderInPeriod(o, period)) &&
          matchesSearch(searchWords, ((o: ExternalOrder) =>
  [
    o.orderNr,
    o.recipientCompany,
    o.recipientContact,
    o.recipientAddress,
    o.loadingCompany,
    o.loadingAddress,
    o.loadingNumber,
    o.unloadingCompany,
    o.unloadingAddress,
    o.cargoDescription,
    o.loadingMeters,
    o.clientCompany,
    o.licensePlate,
    o.driverName,
    o.vehicleType,
    o.notes,
  ])(o), [o.loadingDate, o.unloadingDate])
      ),
    [orders, period, isSearching, searchWords]
  );

  const loadOrders = useCallback(async () => {
    setLoadError(false);
    try {
      setOrders(await getAllExternalOrders());
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Refresh every time this screen becomes active (e.g. after creating or
  // editing an order and navigating back).
  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadOrders();
    }, [loadOrders])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadOrders();
  };

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('chefExternalOrdersList', 'headerSubtitle')} code="CH" />

      <View style={styles.content}>
        <FluidPressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>

        <OrderSearchField value={search} onChange={setSearch} />
        <OrderPeriodFilter period={period} onChange={setPeriod} />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('chefExternalOrdersList', 'title')} ({visibleOrders.length})
          </Text>
          <View style={styles.headerButtons}>
            {/* Angefangene, noch nicht gespeicherte Aufträge (app/chef/drafts.tsx). */}
            <FluidPressable
              style={styles.draftsButton}
              onPress={() => router.push({ pathname: '/chef/drafts', params: { kind: 'external' } })}
            >
              <Text style={styles.draftsButtonText}>
                {t('orderDraft', 'button')}{draftCount > 0 ? ` (${draftCount})` : ''}
              </Text>
            </FluidPressable>
            <FluidPressable style={styles.addButton} onPress={() => router.push('/chef/external-order/new')}>
              <Text style={styles.addButtonText}>{t('chefExternalOrdersList', 'addButton')}</Text>
            </FluidPressable>
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator style={styles.loading} color={c.tint} />
        ) : loadError ? (
          <Text style={styles.errorText}>{t('chefExternalOrdersList', 'loadFailed')}</Text>
        ) : visibleOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {isSearching
                ? t('orderSearch', 'noResults').replace('{query}', search.trim())
                : period === ALL_PERIOD
                ? t('chefExternalOrdersList', 'emptyState')
                : t('chefOrdersList', 'emptyPeriod')}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              {isSearching
                ? t('orderSearch', 'noResultsSub')
                : period === ALL_PERIOD
                ? t('chefExternalOrdersList', 'emptyStateSub')
                : t('chefOrdersList', 'emptyPeriodSub')}
            </Text>
          </View>
        ) : (
          <FlatList
            // Auf Laptop/Desktop als Kartenraster; key erzwingt Neuaufbau beim Spaltenwechsel
            key={`grid-${columns}`}
            numColumns={columns}
            columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
            data={visibleOrders}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
            }
            renderItem={({ item }) => (
              <FluidPressable
                style={styles.orderCard}
                onPress={() =>
                  router.push({ pathname: '/chef/external-order/[id]', params: { id: item.id } })
                }
              >
                <View style={styles.orderCardHeader}>
                  <Text style={styles.orderNr}>Nr. {item.orderNr}</Text>
                  <Text style={styles.editLabel}>{t('chefExternalOrdersList', 'editButton')} ›</Text>
                </View>
                <Text style={styles.recipient}>{item.recipientCompany || '—'}</Text>
                <Text style={styles.route}>
                  {(item.loadingCompany || '—')} → {(item.unloadingCompany || '—')}
                </Text>
                {item.loadingDate ? (
                  <Text style={styles.date}>
                    {t('chefExternalOrdersList', 'loadingOn')} {isoToGerman(item.loadingDate)}
                  </Text>
                ) : null}
              </FluidPressable>
            )}
          />
        )}
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c, scheme } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    container: u.screen,
    content: {
      ...u.column,
      flex: 1,
    },
    backButton: u.backButton,
    backButtonText: u.backButtonText,
    sectionHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    sectionTitle: {
      ...Typography.title2,
      color: c.text,
      flexShrink: 1,
    },
    headerButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    draftsButton: {
      ...u.smallButton,
      backgroundColor: theme.c.surfaceSecondary,
    },
    draftsButtonText: {
      ...u.smallButtonText,
      color: theme.c.text,
    },
    addButton: u.smallButton,
    addButtonText: u.smallButtonText,
    loading: {
      marginTop: Spacing.xl,
    },
    errorText: u.errorText,
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
    orderCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.xs,
      marginBottom: Spacing.xs,
    },
    orderNr: {
      ...Typography.headline,
      color: c.text,
    },
    editLabel: {
      ...Typography.subhead,
      color: c.tint,
      fontWeight: '600',
    },
    recipient: {
      ...Typography.callout,
      fontWeight: '600',
      color: c.text,
      marginBottom: Spacing.xxs,
    },
    route: {
      ...Typography.subhead,
      color: c.textSecondary,
      marginBottom: Spacing.xxs,
    },
    date: {
      ...Typography.footnote,
      color: c.textSecondary,
    },
  });
};
