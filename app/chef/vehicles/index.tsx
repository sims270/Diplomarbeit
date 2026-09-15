import { useAuth } from '@/app/context/AuthContext';
import {
  addVehicle,
  getServiceStatus,
  getVehicles,
  MAX_YEAR_BUILT,
  MIN_YEAR_BUILT,
  type Vehicle,
} from '@/app/services/licensePlateService';
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
 * Die LKW-Übersicht des Chefs — Fahrzeugstamm und Kilometerstände an einem
 * Ort. Eintragen kann er hier, ändern nicht: Das Kennzeichen ist der
 * Schlüssel, über den die Tankungen der Fahrer dem Fahrzeug zugeordnet
 * werden (siehe die Migration), und ein nachträglich geändertes
 * Kennzeichen risse diese Zuordnung auseinander.
 *
 * Der Kilometerstand wird bewusst NICHT eingetippt. Er kommt aus der
 * Tankliste und wird von einem Trigger nachgezogen, sobald ein Fahrer
 * tankt. Deshalb gibt es hier kein km-Feld — nur die Anzeige.
 */
export default function ChefVehiclesScreen() {
  const styles = useThemedStyles(createStyles);
  const { c, scheme, columns } = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { isOfflineMode } = useAuth();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [newPlate, setNewPlate] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newYear, setNewYear] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
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

  const handleAdd = async () => {
    const plate = newPlate.trim().toUpperCase();
    if (!plate) {
      showAlert(t('common', 'error'), t('vehicles', 'alertEmptyPlate'));
      return;
    }

    if (vehicles.some((vehicle) => vehicle.plate.toUpperCase() === plate)) {
      showAlert(t('common', 'error'), `"${plate}" ${t('vehicles', 'alertDuplicate')}`);
      return;
    }

    // Das Baujahr ist optional — ein leeres Feld heißt "weiß ich gerade
    // nicht", und der Chef soll den LKW trotzdem eintragen können. Steht
    // aber etwas drin, muss es eine plausible Jahreszahl sein: Ein
    // Vertipper wie 20019 ginge sonst als Baujahr durch.
    const year = newYear.trim();
    let yearBuilt: number | null = null;
    if (year) {
      const parsed = Number(year);
      if (
        !Number.isInteger(parsed) ||
        parsed < MIN_YEAR_BUILT ||
        parsed > MAX_YEAR_BUILT
      ) {
        showAlert(t('common', 'error'), t('vehicles', 'alertInvalidYear'));
        return;
      }
      yearBuilt = parsed;
    }

    setIsAdding(true);
    try {
      await addVehicle({ plate, model: newModel, yearBuilt });
      setNewPlate('');
      setNewModel('');
      setNewYear('');
      await loadVehicles();
      showAlert(t('common', 'success'), `"${plate}" ${t('vehicles', 'alertAdded')}`);
    } catch (error) {
      showAlert(
        t('common', 'error'),
        error instanceof Error ? error.message : t('vehicles', 'alertAddFailed')
      );
    } finally {
      setIsAdding(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadVehicles();
  };

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('vehicles', 'headerSubtitle')} code="CH" />

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
              <Text style={styles.addTitle}>{t('vehicles', 'addSectionTitle')}</Text>
              <TextInput
                placeholderTextColor={c.placeholder}
                keyboardAppearance={scheme}
                style={styles.input}
                value={newPlate}
                onChangeText={setNewPlate}
                placeholder={t('vehicles', 'addPlaceholder')}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isAdding}
              />
              <TextInput
                placeholderTextColor={c.placeholder}
                keyboardAppearance={scheme}
                style={[styles.input, styles.inputSpaced]}
                value={newModel}
                onChangeText={setNewModel}
                placeholder={t('vehicles', 'modelPlaceholder')}
                editable={!isAdding}
              />
              <View style={styles.addRow}>
                <TextInput
                  placeholderTextColor={c.placeholder}
                  keyboardAppearance={scheme}
                  style={[styles.input, styles.inputSpaced, styles.addInput]}
                  value={newYear}
                  onChangeText={setNewYear}
                  placeholder={t('vehicles', 'yearPlaceholder')}
                  keyboardType="numeric"
                  maxLength={4}
                  editable={!isAdding}
                  onSubmitEditing={handleAdd}
                />
                <FluidPressable
                  style={[styles.addButton, isAdding && styles.buttonDisabled]}
                  onPress={handleAdd}
                  disabled={isAdding}
                >
                  {isAdding ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.addButtonText}>{t('vehicles', 'addButton')}</Text>
                  )}
                </FluidPressable>
              </View>
              <Text style={styles.hint}>{t('vehicles', 'hint')}</Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>
            {t('vehicles', 'title')} ({vehicles.length})
          </Text>

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
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
              }
              renderItem={({ item }) => (
                <FluidPressable
                  style={[
                    styles.vehicleCard,
                    item.retiredAt !== null && styles.vehicleCardRetired,
                  ]}
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
                      },
                    })
                  }
                >
                  <View style={styles.vehicleHeader}>
                    <View style={styles.vehicleTitle}>
                      <Text style={styles.vehiclePlate}>{item.plate}</Text>
                      {item.retiredAt !== null && (
                        <View style={styles.retiredBadge}>
                          <Text style={styles.retiredBadgeText}>
                            {t('vehicles', 'retiredBadge')}
                          </Text>
                        </View>
                      )}
                      {/* Am ausgeflotteten LKW wäre die Meldung sinnlos —
                          der fährt nicht mehr. */}
                      {item.retiredAt === null && getServiceStatus(item)?.isDue && (
                        <View style={styles.serviceBadge}>
                          <Text style={styles.serviceBadgeText}>
                            {t('vehicles', 'serviceDueBadge')}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.editLabel}>{t('vehicles', 'editButton')} ›</Text>
                  </View>

                  <View style={styles.vehicleRow}>
                    <Text style={styles.vehicleLabel}>{t('vehicles', 'modelLabel')}</Text>
                    <Text style={styles.vehicleText}>
                      {item.model || t('vehicles', 'notSet')}
                    </Text>
                  </View>

                  <View style={styles.vehicleRow}>
                    <Text style={styles.vehicleLabel}>{t('vehicles', 'yearLabel')}</Text>
                    <Text style={styles.vehicleText}>
                      {item.yearBuilt ?? t('vehicles', 'notSet')}
                    </Text>
                  </View>

                  <View style={styles.vehicleRow}>
                    <Text style={styles.vehicleLabel}>{t('vehicles', 'kmLabel')}</Text>
                    <Text style={styles.vehicleValue}>
                      {item.kmStand === null
                        ? '—'
                        : `${item.kmStand.toLocaleString('de-DE')} km`}
                    </Text>
                  </View>

                  <Text style={styles.vehicleMeta}>
                    {item.kmEntryDate
                      ? `${t('vehicles', 'kmFrom')} ${isoToGerman(item.kmEntryDate)}`
                      : t('vehicles', 'kmNone')}
                  </Text>
                </FluidPressable>
              )}
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
    addRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Spacing.xs,
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
    addInput: {
      flex: 1,
    },
    addButton: {
      ...u.primaryButton,
      minHeight: 48,
      paddingHorizontal: Spacing.md + 2,
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
    vehicleCard: {
      ...u.gridItem,
      ...u.card,
      marginBottom: Spacing.sm,
      borderLeftWidth: 4,
      borderLeftColor: c.tintFill,
      ...shadow(1, scheme),
    },
    vehicleCardRetired: {
      borderLeftColor: c.textTertiary,
    },
    vehicleHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.xs,
      marginBottom: Spacing.xs,
    },
    vehicleTitle: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.xs,
      flex: 1,
    },
    serviceBadge: {
      ...u.badge,
      backgroundColor: c.tintFill,
    },
    serviceBadgeText: u.badgeText,
    retiredBadge: {
      ...u.badge,
      backgroundColor: c.surfaceTertiary,
    },
    retiredBadgeText: {
      ...u.badgeText,
      color: c.textSecondary,
    },
    vehiclePlate: {
      ...Typography.headline,
      color: c.text,
    },
    editLabel: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.tint,
    },
    vehicleText: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.text,
    },
    vehicleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: 2,
    },
    vehicleLabel: {
      ...Typography.subhead,
      color: c.textSecondary,
    },
    vehicleValue: {
      ...Typography.headline,
      color: c.text,
      fontVariant: ['tabular-nums'],
    },
    vehicleMeta: {
      ...Typography.footnote,
      color: c.textSecondary,
      marginTop: Spacing.xxs,
    },
  });
};
