import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuth } from '@/app/context/AuthContext';
import { getPickerlStatus } from '@/app/services/licensePlateService';
import { getPermitStatus, getTrailers, type Trailer } from '@/app/services/trailerService';
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

/**
 * Die Auflieger des Chefs. Sie werden niemandem zugeteilt — die Liste ist
 * nur dazu da, Pickerl und Genehmigungen im Blick zu behalten. Aufbau wie die
 * Fahrerverwaltung (app/chef/drivers/index.tsx).
 */
export default function ChefTrailersScreen() {
  const styles = useThemedStyles(createStyles);
  const { c, columns } = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { isOfflineMode } = useAuth();

  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadTrailers = useCallback(async () => {
    setLoadError(null);

    // Wie bei den LKW: offline gibt es kein JWT für die RLS-Policy.
    if (isOfflineMode) {
      setTrailers([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      setTrailers(await getTrailers());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isOfflineMode]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadTrailers();
    }, [loadTrailers])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadTrailers();
  };

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('trailers', 'headerSubtitle')} code="CH" />

      <View style={styles.content}>
        <FluidPressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('trailers', 'title')} ({trailers.length})
          </Text>
          {!isOfflineMode && (
            <FluidPressable style={styles.addButton} onPress={() => router.push('/chef/trailers/new')}>
              <Text style={styles.addButtonText}>{t('trailers', 'newButton')}</Text>
            </FluidPressable>
          )}
        </View>

        {isOfflineMode ? (
          <Text style={styles.errorText}>{t('common', 'offlineModeHint')}</Text>
        ) : isLoading ? (
          <ActivityIndicator style={styles.loading} color={c.tint} />
        ) : loadError !== null ? (
          <>
            <Text style={styles.errorText}>{t('trailers', 'loadFailed')}</Text>
            {!!loadError && <Text style={styles.errorDetail}>{loadError}</Text>}
          </>
        ) : trailers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{t('trailers', 'emptyState')}</Text>
            <Text style={styles.emptyStateSub}>{t('trailers', 'emptyStateSub')}</Text>
          </View>
        ) : (
          <FlatList
            // Auf Laptop/Desktop als Kartenraster; key erzwingt Neuaufbau beim Spaltenwechsel
            key={`grid-${columns}`}
            numColumns={columns}
            columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
            data={trailers}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
            }
            renderItem={({ item }) => {
              const pickerl = getPickerlStatus(item.pickerlDueDate);
              const permitDue = item.permits.some(
                (permit) => getPermitStatus(permit.validUntil)?.isDue
              );
              const pickerlDate = item.pickerlDueDate
                ? isoToGerman(item.pickerlDueDate)
                : t('vehicles', 'notSet');
              return (
                <FluidPressable
                  style={styles.trailerCard}
                  onPress={() =>
                    router.push({
                      pathname: '/chef/trailers/[id]',
                      params: {
                        id: item.id,
                        plate: item.plate,
                        description: item.description,
                        pickerlDueDate: item.pickerlDueDate ?? '',
                      },
                    })
                  }
                >
                  <View style={styles.avatar}>
                    <MaterialIcons name="rv-hookup" size={22} color={c.onTint} />
                  </View>
                  <View style={styles.info}>
                    <View style={styles.titleRow}>
                      <Text style={styles.plate}>{item.plate}</Text>
                      {pickerl?.isDue && (
                        <View style={styles.dueBadge}>
                          <Text style={styles.dueBadgeText}>
                            {t('vehicles', 'pickerlDueBadge')}
                          </Text>
                        </View>
                      )}
                      {permitDue && (
                        <View style={styles.dueBadge}>
                          <Text style={styles.dueBadgeText}>{t('trailers', 'permitDueBadge')}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.infoLine} numberOfLines={1}>
                      {`${item.description || t('vehicles', 'notSet')} · ${t('vehicles', 'pickerlDueLabel')}: ${pickerlDate}`}
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
    trailerCard: {
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
    editLabel: {
      ...Typography.subhead,
      color: c.tint,
      fontWeight: '600',
      paddingLeft: Spacing.xs,
    },
  });
};
