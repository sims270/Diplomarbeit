import { useAuth } from '@/app/context/AuthContext';
import { getPickerlStatus } from '@/app/services/licensePlateService';
import { addTrailer, getTrailers, type Trailer } from '@/app/services/trailerService';
import { DateField } from '@/components/DateField';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { shadow, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert } from '@/lib/alert';
import { isoToGerman } from '@/lib/dateFormat';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

/**
 * Die Auflieger des Chefs. Sie werden niemandem zugeteilt — die Liste ist
 * nur dazu da, das Pickerl im Blick zu behalten. Aufbau wie die
 * LKW-Übersicht (app/chef/vehicles/index.tsx).
 */
export default function ChefTrailersScreen() {
  const styles = useThemedStyles(createStyles);
  const { c, scheme, columns } = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { isOfflineMode } = useAuth();

  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [newPlate, setNewPlate] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPickerlDate, setNewPickerlDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
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

  const handleAdd = async () => {
    const plate = newPlate.trim().toUpperCase();
    if (!plate) {
      showAlert(t('common', 'error'), t('trailers', 'alertEmptyPlate'));
      return;
    }

    if (trailers.some((trailer) => trailer.plate.toUpperCase() === plate)) {
      showAlert(t('common', 'error'), `"${plate}" ${t('trailers', 'alertDuplicate')}`);
      return;
    }

    setIsAdding(true);
    try {
      await addTrailer({
        plate,
        description: newDescription,
        pickerlDueDate: newPickerlDate || null,
      });
      setNewPlate('');
      setNewDescription('');
      setNewPickerlDate('');
      await loadTrailers();
      showAlert(t('common', 'success'), `"${plate}" ${t('trailers', 'alertAdded')}`);
    } catch (error) {
      showAlert(
        t('common', 'error'),
        error instanceof Error ? error.message : t('trailers', 'alertAddFailed')
      );
    } finally {
      setIsAdding(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadTrailers();
  };

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('trailers', 'headerSubtitle')} code="CH" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <FluidPressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
          </FluidPressable>

          {!isOfflineMode && (
            <View style={styles.addCard}>
              <Text style={styles.addTitle}>{t('trailers', 'addSectionTitle')}</Text>
              <TextInput
                placeholderTextColor={c.placeholder}
                keyboardAppearance={scheme}
                style={styles.input}
                value={newPlate}
                onChangeText={setNewPlate}
                placeholder={t('trailers', 'addPlaceholder')}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isAdding}
              />
              <TextInput
                placeholderTextColor={c.placeholder}
                keyboardAppearance={scheme}
                style={[styles.input, styles.inputSpaced]}
                value={newDescription}
                onChangeText={setNewDescription}
                placeholder={t('trailers', 'descriptionPlaceholder')}
                editable={!isAdding}
              />
              <View style={styles.inputSpaced}>
                <DateField
                  value={newPickerlDate}
                  onChange={setNewPickerlDate}
                  placeholder={t('trailers', 'pickerlPlaceholder')}
                />
              </View>
              <FluidPressable
                style={[styles.addButton, isAdding && styles.buttonDisabled]}
                onPress={handleAdd}
                disabled={isAdding}
              >
                {isAdding ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.addButtonText}>{t('trailers', 'addButton')}</Text>
                )}
              </FluidPressable>
              {/* Genehmigungen kommen erst im Bearbeiten-Screen dazu — dafür
                  braucht es den angelegten Auflieger. */}
              <Text style={styles.hint}>{t('trailers', 'hint')}</Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>
            {t('trailers', 'title')} ({trailers.length})
          </Text>

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
              key={`grid-${columns}`}
              numColumns={columns}
              columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
              data={trailers}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
              }
              renderItem={({ item }) => {
                const pickerl = getPickerlStatus(item.pickerlDueDate);
                // Nach Ablaufdatum sortiert — die erste läuft zuerst ab.
                const nextPermit = item.permits[0];
                const permitDue = item.permits.some(
                  (permit) => getPickerlStatus(permit.validUntil)?.isDue
                );
                return (
                  <FluidPressable
                    style={styles.card}
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
                    <View style={styles.cardHeader}>
                      <View style={styles.cardTitle}>
                        <Text style={styles.plate}>{item.plate}</Text>
                        {pickerl?.isDue && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                              {t('vehicles', 'pickerlDueBadge')}
                            </Text>
                          </View>
                        )}
                        {permitDue && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{t('trailers', 'permitDueBadge')}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.editLabel}>{t('vehicles', 'editButton')} ›</Text>
                    </View>

                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>{t('trailers', 'descriptionLabel')}</Text>
                      <Text style={styles.rowText}>
                        {item.description || t('vehicles', 'notSet')}
                      </Text>
                    </View>

                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>{t('vehicles', 'pickerlDueLabel')}</Text>
                      <Text style={[styles.rowText, pickerl?.isDue && styles.rowDue]}>
                        {item.pickerlDueDate
                          ? isoToGerman(item.pickerlDueDate)
                          : t('vehicles', 'notSet')}
                      </Text>
                    </View>

                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>{t('trailers', 'permitsSection')}</Text>
                      <Text style={[styles.rowText, permitDue && styles.rowDue]}>
                        {nextPermit
                          ? `${item.permits.length} · ${t('trailers', 'permitNext')} ${isoToGerman(
                              nextPermit.validUntil
                            )}`
                          : t('trailers', 'permitsNone')}
                      </Text>
                    </View>
                  </FluidPressable>
                );
              }}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c, scheme } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    container: u.screen,
    flex: {
      flex: 1,
    },
    content: {
      ...u.column,
      flex: 1,
    },
    backButton: u.backButton,
    backButtonText: u.backButtonText,
    addCard: {
      ...u.card,
      marginBottom: Spacing.lg,
    },
    addTitle: {
      ...u.sectionTitle,
      marginTop: 0,
      paddingHorizontal: 0,
    },
    input: {
      ...u.input,
      marginBottom: 0,
      backgroundColor: c.surfaceSecondary,
      borderColor: 'transparent',
    },
    inputSpaced: {
      marginTop: Spacing.xs,
    },
    addButton: {
      ...u.primaryButton,
      marginTop: Spacing.sm,
    },
    addButtonText: u.primaryButtonText,
    buttonDisabled: u.disabled,
    hint: {
      ...u.hint,
      marginTop: Spacing.sm,
    },
    sectionTitle: {
      ...Typography.title2,
      color: c.text,
      marginBottom: Spacing.sm,
    },
    loading: {
      marginTop: Spacing.lg,
    },
    errorText: {
      ...Typography.subhead,
      color: c.textSecondary,
    },
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
    card: {
      ...u.gridItem,
      ...u.card,
      marginBottom: Spacing.sm,
      borderLeftWidth: 4,
      borderLeftColor: c.tintFill,
      ...shadow(1, scheme),
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.xs,
      marginBottom: Spacing.xs,
    },
    cardTitle: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.xs,
      flex: 1,
    },
    badge: {
      ...u.badge,
      backgroundColor: c.tintFill,
    },
    badgeText: u.badgeText,
    plate: {
      ...Typography.headline,
      color: c.text,
    },
    editLabel: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.tint,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: 2,
    },
    rowLabel: {
      ...Typography.subhead,
      color: c.textSecondary,
    },
    rowText: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.text,
      flexShrink: 1,
      textAlign: 'right',
    },
    rowDue: {
      color: c.danger,
    },
  });
};
