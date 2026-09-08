import { type ExternalOrder, getAllExternalOrders } from '@/app/services/externalOrderService';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Colors } from '@/constants/theme';
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
          <ActivityIndicator style={styles.loading} color={Colors.ui.primary} />
        ) : loadError ? (
          <Text style={styles.errorText}>{t('chefExternalOrdersList', 'loadFailed')}</Text>
        ) : orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{t('chefExternalOrdersList', 'emptyState')}</Text>
            <Text style={styles.emptyStateSubtext}>{t('chefExternalOrdersList', 'emptyStateSub')}</Text>
          </View>
        ) : (
          <FlatList
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.lightGray,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  backButton: {
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    textTransform: 'uppercase',
  },
  addButton: {
    backgroundColor: Colors.ui.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  loading: {
    marginTop: 32,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 32,
    color: Colors.ui.primary,
  },
  emptyState: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ui.darkGray,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.ui.darkGray,
    textAlign: 'center',
  },
  orderCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: Colors.ui.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderNr: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
  },
  editLabel: {
    fontSize: 12,
    color: Colors.ui.primary,
    fontWeight: '600',
  },
  recipient: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.charcoal,
    marginBottom: 4,
  },
  route: {
    fontSize: 12,
    color: Colors.ui.darkGray,
    marginBottom: 4,
  },
  date: {
    fontSize: 11,
    color: Colors.ui.darkGray,
  },
});
