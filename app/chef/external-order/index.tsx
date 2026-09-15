import { type ExternalOrder, getAllExternalOrders } from '@/app/services/externalOrderService';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { shadow, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useTranslation } from '@/hooks/use-translation';
import { isoToGerman } from '@/lib/dateFormat';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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
  const { t } = useTranslation();
  const [orders, setOrders] = useState<ExternalOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

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

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('chefExternalOrdersList', 'title')} ({orders.length})
          </Text>
          <FluidPressable style={styles.addButton} onPress={() => router.push('/chef/external-order/new')}>
            <Text style={styles.addButtonText}>{t('chefExternalOrdersList', 'addButton')}</Text>
          </FluidPressable>
        </View>

        {isLoading ? (
          <ActivityIndicator style={styles.loading} color={c.tint} />
        ) : loadError ? (
          <Text style={styles.errorText}>{t('chefExternalOrdersList', 'loadFailed')}</Text>
        ) : orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{t('chefExternalOrdersList', 'emptyState')}</Text>
            <Text style={styles.emptyStateSubtext}>{t('chefExternalOrdersList', 'emptyStateSub')}</Text>
          </View>
        ) : (
          <FlatList
            // Auf Laptop/Desktop als Kartenraster; key erzwingt Neuaufbau beim Spaltenwechsel
            key={`grid-${columns}`}
            numColumns={columns}
            columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
            data={orders}
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
