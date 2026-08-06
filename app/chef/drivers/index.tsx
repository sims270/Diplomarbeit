import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Colors } from '@/constants/theme';
import { useTranslation } from '@/hooks/use-translation';
import { supabase } from '@/lib/supabase';
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

interface Driver {
  id: string;
  username: string;
  createdAt: string;
}

export default function DriversListScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadDrivers = useCallback(async () => {
    setLoadError(false);
    try {
      const { data, error } = await supabase.functions.invoke('list-drivers', {
        method: 'GET',
      });
      if (error || data?.error) {
        throw new Error(data?.error ?? error?.message ?? 'Unknown error');
      }
      setDrivers(data.drivers ?? []);
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Refresh every time this screen becomes active (e.g. after creating
  // or editing a driver and navigating back).
  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadDrivers();
    }, [loadDrivers])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadDrivers();
  };

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('driversList', 'headerSubtitle')} code="CH" />

      <View style={styles.content}>
        <FluidPressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('driversList', 'title')} ({drivers.length})
          </Text>
          <FluidPressable style={styles.addButton} onPress={() => router.push('/chef/drivers/new')}>
            <Text style={styles.addButtonText}>{t('driversList', 'addButton')}</Text>
          </FluidPressable>
        </View>

        {isLoading ? (
          <ActivityIndicator style={styles.loading} color={Colors.ui.primary} />
        ) : loadError ? (
          <Text style={styles.errorText}>{t('driversList', 'loadFailed')}</Text>
        ) : drivers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{t('driversList', 'emptyState')}</Text>
            <Text style={styles.emptyStateSubtext}>{t('driversList', 'emptyStateSub')}</Text>
          </View>
        ) : (
          <FlatList
            data={drivers}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
            }
            renderItem={({ item }) => (
              <FluidPressable
                style={styles.driverCard}
                onPress={() =>
                  router.push({
                    pathname: '/chef/drivers/[id]',
                    params: { id: item.id, username: item.username },
                  })
                }
              >
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>
                    {item.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.driverUsername}>{item.username}</Text>
                <Text style={styles.editLabel}>{t('driversList', 'editButton')} ›</Text>
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
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  driverAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.ui.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverAvatarText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
  driverUsername: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.ui.charcoal,
  },
  editLabel: {
    fontSize: 13,
    color: Colors.ui.primary,
    fontWeight: '600',
  },
});
