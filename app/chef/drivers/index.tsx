import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { shadow, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useAuth } from '@/app/context/AuthContext';
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
  licensePlate?: string;
  createdAt: string;
}

export default function DriversListScreen() {
  const styles = useThemedStyles(createStyles);
  const { c, columns } = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { isOfflineMode } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadDrivers = useCallback(async () => {
    setLoadError(false);

    // Im Offline-Modus gibt es kein JWT, das die Edge Function akzeptieren
    // könnte — der Aufruf würde zwangsläufig scheitern. Statt den Nutzer in
    // einen Netzwerkfehler laufen zu lassen, sagen wir gleich warum.
    if (isOfflineMode) {
      setDrivers([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

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
  }, [isOfflineMode]);

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
          {!isOfflineMode && (
            <FluidPressable style={styles.addButton} onPress={() => router.push('/chef/drivers/new')}>
              <Text style={styles.addButtonText}>{t('driversList', 'addButton')}</Text>
            </FluidPressable>
          )}
        </View>

        {isOfflineMode ? (
          <Text style={styles.errorText}>{t('common', 'offlineModeHint')}</Text>
        ) : isLoading ? (
          <ActivityIndicator style={styles.loading} color={c.tint} />
        ) : loadError ? (
          <Text style={styles.errorText}>{t('driversList', 'loadFailed')}</Text>
        ) : drivers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{t('driversList', 'emptyState')}</Text>
            <Text style={styles.emptyStateSubtext}>{t('driversList', 'emptyStateSub')}</Text>
          </View>
        ) : (
          <FlatList
            // Auf Laptop/Desktop als Kartenraster; key erzwingt Neuaufbau beim Spaltenwechsel
            key={`grid-${columns}`}
            numColumns={columns}
            columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
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
                    params: {
                      id: item.id,
                      username: item.username,
                      licensePlate: item.licensePlate ?? '',
                    },
                  })
                }
              >
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>
                    {item.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.driverInfo}>
                  <Text style={styles.driverUsername}>{item.username}</Text>
                  {!!item.licensePlate && (
                    <Text style={styles.driverPlate}>{item.licensePlate}</Text>
                  )}
                </View>
                <Text style={styles.editLabel}>{t('driversList', 'editButton')} ›</Text>
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
    // Zeile im Stil einer iOS-Kontaktliste
    gridRow: u.gridRow,
    driverCard: {
      ...u.gridItem,
      ...u.card,
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.xs,
      ...shadow(1, scheme),
    },
    driverAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.tintFill,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.sm,
    },
    driverAvatarText: {
      ...Typography.headline,
      color: c.onTint,
    },
    driverInfo: {
      flex: 1,
    },
    driverUsername: {
      ...Typography.headline,
      color: c.text,
    },
    driverPlate: {
      ...Typography.footnote,
      fontWeight: '600',
      color: c.textSecondary,
      marginTop: 2,
    },
    editLabel: {
      ...Typography.subhead,
      color: c.tint,
      fontWeight: '600',
      paddingLeft: Spacing.xs,
    },
  });
};
