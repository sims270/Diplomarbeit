import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuth } from '@/app/context/AuthContext';
import {
  getPickerlStatus,
  getServiceStatus,
  getVehicles,
  type Vehicle,
} from '@/app/services/licensePlateService';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { shadow, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useTranslation } from '@/hooks/use-translation';
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

/**
 * Die LKW-Übersicht des Chefs, aufgebaut wie die Fahrerverwaltung
 * (app/chef/drivers/index.tsx). Eingetragen wird auf einer eigenen Seite
 * (new.tsx), das Kennzeichen lässt sich danach nicht mehr ändern: Darüber
 * werden die Tankungen der Fahrer dem Fahrzeug zugeordnet.
 *
 * Der Kilometerstand wird bewusst NICHT eingetippt. Er kommt aus der
 * Tankliste und wird von einem Trigger nachgezogen, sobald ein Fahrer tankt.
 */
export default function ChefVehiclesScreen() {
  const styles = useThemedStyles(createStyles);
  const { c, columns } = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { isOfflineMode } = useAuth();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Nicht nur ein Flag, sondern die Meldung von Supabase: Eine fehlende
  // Spalte und eine abgelehnte RLS-Policy sehen sonst gleich aus, und
  // "konnte nicht geladen werden" sagt dann nichts.
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadVehicles = useCallback(async () => {
    setLoadError(null);

    // Wie in der Fahrerverwaltung: Im Offline-Modus gibt es kein JWT, an
    // dem die RLS-Policy den Chef erkennen könnte — der Aufruf käme
    // zwangsläufig leer zurück. Dann lieber gleich sagen, warum.
    if (isOfflineMode) {
      setVehicles([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      setVehicles(await getVehicles());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isOfflineMode]);

  // Bei jedem Öffnen neu laden: Die Kilometerstände ändern sich, während
  // der Chef gar nicht in der App ist — nämlich dann, wenn ein Fahrer tankt.
  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadVehicles();
    }, [loadVehicles])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadVehicles();
  };

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('vehicles', 'headerSubtitle')} code="CH" />

      <View style={styles.content}>
        <FluidPressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('vehicles', 'title')} ({vehicles.length})
          </Text>
          {!isOfflineMode && (
            <FluidPressable style={styles.addButton} onPress={() => router.push('/chef/vehicles/new')}>
              <Text style={styles.addButtonText}>{t('vehicles', 'newButton')}</Text>
            </FluidPressable>
          )}
        </View>

        {isOfflineMode ? (
          <Text style={styles.errorText}>{t('common', 'offlineModeHint')}</Text>
        ) : isLoading ? (
          <ActivityIndicator style={styles.loading} color={c.tint} />
        ) : loadError !== null ? (
          <>
            <Text style={styles.errorText}>{t('vehicles', 'loadFailed')}</Text>
            {!!loadError && <Text style={styles.errorDetail}>{loadError}</Text>}
          </>
        ) : vehicles.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{t('vehicles', 'emptyState')}</Text>
            <Text style={styles.emptyStateSub}>{t('vehicles', 'emptyStateSub')}</Text>
          </View>
        ) : (
          <FlatList
            // Auf Laptop/Desktop als Kartenraster; key erzwingt Neuaufbau beim Spaltenwechsel
            key={`grid-${columns}`}
            numColumns={columns}
            columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
            data={vehicles}
            keyExtractor={(item) => item.plate}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
            }
            renderItem={({ item }) => {
              const isRetired = item.retiredAt !== null;
              const km =
                item.kmStand === null ? '—' : `${item.kmStand.toLocaleString('de-DE')} km`;
              return (
                <FluidPressable
                  style={styles.vehicleCard}
                  onPress={() =>
                    router.push({
                      pathname: '/chef/vehicles/[id]',
                      params: {
                        id: item.id,
                        plate: item.plate,
                        model: item.model,
                        yearBuilt: item.yearBuilt === null ? '' : String(item.yearBuilt),
                        retiredAt: item.retiredAt ?? '',
                        kmStand: item.kmStand === null ? '' : String(item.kmStand),
                        serviceIntervalKm:
                          item.serviceIntervalKm === null ? '' : String(item.serviceIntervalKm),
                        lastServiceKm:
                          item.lastServiceKm === null ? '' : String(item.lastServiceKm),
                        pickerlDueDate: item.pickerlDueDate ?? '',
                      },
                    })
                  }
                >
                  <View style={[styles.avatar, isRetired && styles.avatarRetired]}>
                    <MaterialIcons
                      name="local-shipping"
                      size={22}
                      color={isRetired ? c.textSecondary : c.onTint}
                    />
                  </View>
                  <View style={styles.info}>
                    <View style={styles.titleRow}>
                      <Text style={styles.plate}>{item.plate}</Text>
                      {isRetired && (
                        <View style={styles.retiredBadge}>
                          <Text style={styles.retiredBadgeText}>
                            {t('vehicles', 'retiredBadge')}
                          </Text>
                        </View>
                      )}
                      {/* Am ausgeflotteten LKW wäre die Meldung sinnlos —
                          der fährt nicht mehr. */}
                      {!isRetired && getServiceStatus(item)?.isDue && (
                        <View style={styles.dueBadge}>
                          <Text style={styles.dueBadgeText}>
                            {t('vehicles', 'serviceDueBadge')}
                          </Text>
                        </View>
                      )}
                      {!isRetired && getPickerlStatus(item.pickerlDueDate)?.isDue && (
                        <View style={styles.dueBadge}>
                          <Text style={styles.dueBadgeText}>
                            {t('vehicles', 'pickerlDueBadge')}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.infoLine} numberOfLines={1}>
                      {`${item.model || t('vehicles', 'notSet')} · ${km}`}
                    </Text>
                  </View>
                  <Text style={styles.editLabel}>{t('vehicles', 'editButton')} ›</Text>
                </FluidPressable>
              );
            }}
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
    errorDetail: {
      ...Typography.footnote,
      color: c.textSecondary,
      marginTop: Spacing.xs - 2,
      fontStyle: 'italic',
    },
    emptyState: u.emptyState,
    emptyStateText: u.emptyStateText,
    emptyStateSub: u.emptyStateSubtext,
    gridRow: u.gridRow,
    vehicleCard: {
      ...u.gridItem,
      ...u.card,
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.xs,
      ...shadow(1, scheme),
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.tintFill,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.sm,
    },
    avatarRetired: {
      backgroundColor: c.surfaceTertiary,
    },
    info: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    plate: {
      ...Typography.headline,
      color: c.text,
    },
    infoLine: {
      ...Typography.footnote,
      fontWeight: '600',
      color: c.textSecondary,
      marginTop: 2,
    },
    dueBadge: {
      ...u.badge,
      backgroundColor: c.tintFill,
    },
    dueBadgeText: u.badgeText,
    retiredBadge: {
      ...u.badge,
      backgroundColor: c.surfaceTertiary,
    },
    retiredBadgeText: {
      ...u.badgeText,
      color: c.textSecondary,
    },
    editLabel: {
      ...Typography.subhead,
      color: c.tint,
      fontWeight: '600',
      paddingLeft: Spacing.xs,
    },
  });
};
