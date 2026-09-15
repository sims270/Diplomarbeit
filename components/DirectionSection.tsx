import { useAuth } from '@/app/context/AuthContext';
import {
  DIRECTION_SUGGESTIONS,
  getRevenueTrips,
  setOrderDirection,
  type RevenueTrip,
} from '@/app/services/revenueListService';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Layout, Radius, shadow, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert } from '@/lib/alert';
import { isoToGerman } from '@/lib/dateFormat';
import { plateKey } from '@/lib/plateKey';
import { useFocusEffect, useRouter } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

/**
 * Die Umsatzliste aus Sicht des Chefs: Hier trägt er zu jeder erledigten
 * Komplettladung die Richtung ein ("hin", "her", "FR - DE") — dasselbe
 * Prinzip wie die Preise in der Tankliste (components/TankPricesSection.tsx).
 * Nur was in der App steht, landet in jedem Export; in Excel Nachgetragenes
 * ginge beim nächsten Export verloren. Steht im Tankliste-Tab unter den
 * Preisen (app/chef/(tabs)/tank.tsx).
 *
 * Beilader haben in der Liste nur einen Betrag, also hier auch kein
 * Richtungsfeld. Fehlt einer Fahrt der Preis, führt ein Tippen zum Auftrag,
 * wo der Chef ihn in der Rechnung einträgt.
 */

const needsDirection = (trip: RevenueTrip) =>
  trip.cargoType === 'komplett' && !trip.direction.trim();

const isIncomplete = (trip: RevenueTrip) => needsDirection(trip) || trip.price === null;

const formatKm = (km: number | null) => (km === null ? '–' : km.toLocaleString('de-DE'));

export function DirectionSection({
  action,
  refreshSignal,
  month,
  selectedPlate,
}: {
  /** Steht unter dem Hinweis — im Tab der Button "Umsatzliste exportieren". */
  action?: ReactNode;
  /** Hochzählen lädt neu (Pull-to-Refresh der ScrollView im Tab). */
  refreshSignal: number;
  /** 'YYYY-MM' — nur Fahrten aus diesem Monat. */
  month: string;
  /** Schlüssel aus lib/plateKey.ts, null = alle Kennzeichen. */
  selectedPlate: string | null;
}) {
  const styles = useThemedStyles(createStyles);
  const { c, columns } = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { isOfflineMode } = useAuth();

  const [trips, setTrips] = useState<RevenueTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [onlyMissing, setOnlyMissing] = useState(true);
  // Wie in der Tankliste: Der Filter richtet sich nach dem Stand beim Laden,
  // sonst verschwände eine Zeile beim Speichern unter dem Finger.
  const [missingAtLoad, setMissingAtLoad] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoadError(null);

    if (isOfflineMode) {
      setTrips([]);
      setIsLoading(false);
      return;
    }

    try {
      const loaded = await getRevenueTrips();
      setTrips(loaded);
      setMissingAtLoad(new Set(loaded.filter(isIncomplete).map((trip) => trip.orderId)));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '');
    } finally {
      setIsLoading(false);
    }
  }, [isOfflineMode]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      load();
    }, [load])
  );

  useEffect(() => {
    if (refreshSignal === 0) return;
    setIsLoading(true);
    load();
    // Nur auf das Signal reagieren — das Laden beim Fokus übernimmt oben useFocusEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  // Monat und Kennzeichen aus der Leiste oben im Tab. Fahrten ohne Lade- und
  // Entladedatum lassen sich keinem Monat zuordnen — sie stehen deshalb in
  // jedem Monat, statt nirgends mehr aufzutauchen.
  const inScope = useMemo(
    () =>
      trips.filter(
        (trip) =>
          (!trip.date || trip.date.startsWith(month)) &&
          (selectedPlate === null ||
            (trip.licensePlate !== null && plateKey(trip.licensePlate) === selectedPlate))
      ),
    [trips, month, selectedPlate]
  );

  const visible = useMemo(
    () =>
      onlyMissing ? inScope.filter((trip) => missingAtLoad.has(trip.orderId)) : inScope,
    [inScope, missingAtLoad, onlyMissing]
  );

  // Kartenraster wie in components/TankPricesSection.tsx
  const rows = useMemo(() => {
    const out: RevenueTrip[][] = [];
    for (let i = 0; i < visible.length; i += columns) out.push(visible.slice(i, i + columns));
    return out;
  }, [visible, columns]);

  const missingCount = inScope.filter(isIncomplete).length;

  const handleSaved = (orderId: string, direction: string) =>
    setTrips((prev) =>
      prev.map((trip) => (trip.orderId === orderId ? { ...trip, direction } : trip))
    );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('chefUmsatzliste', 'title')}</Text>
      <Text style={styles.hint}>{t('chefUmsatzliste', 'hint')}</Text>

      {action}

      <View style={styles.filterRow}>
        <FluidPressable
          style={[styles.filterChip, onlyMissing && styles.filterChipActive]}
          onPress={() => setOnlyMissing(true)}
        >
          <Text style={[styles.filterText, onlyMissing && styles.filterTextActive]}>
            {`${t('chefUmsatzliste', 'filterMissing')} (${missingCount})`}
          </Text>
        </FluidPressable>
        <FluidPressable
          style={[styles.filterChip, !onlyMissing && styles.filterChipActive]}
          onPress={() => setOnlyMissing(false)}
        >
          <Text style={[styles.filterText, !onlyMissing && styles.filterTextActive]}>
            {`${t('chefUmsatzliste', 'filterAll')} (${inScope.length})`}
          </Text>
        </FluidPressable>
      </View>

      {isOfflineMode ? (
        <Text style={styles.errorText}>{t('common', 'offlineModeHint')}</Text>
      ) : isLoading ? (
        <ActivityIndicator style={styles.loading} color={c.tint} />
      ) : loadError !== null ? (
        <>
          <Text style={styles.errorText}>{t('chefUmsatzliste', 'loadFailed')}</Text>
          {!!loadError && <Text style={styles.errorDetail}>{loadError}</Text>}
        </>
      ) : visible.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            {onlyMissing
              ? t('chefUmsatzliste', 'emptyMissing')
              : t('chefUmsatzliste', 'emptyAll')}
          </Text>
        </View>
      ) : (
        rows.map((row) => (
          <View key={row[0].orderId} style={columns > 1 ? styles.gridRow : undefined}>
            {row.map((item) => (
              <TripRow
                key={item.orderId}
                trip={item}
                onSaved={handleSaved}
                onOpenOrder={() =>
                  router.push({ pathname: '/chef/order/[id]', params: { id: item.orderId } })
                }
              />
            ))}
          </View>
        ))
      )}
    </View>
  );
}

function TripRow({
  trip,
  onSaved,
  onOpenOrder,
}: {
  trip: RevenueTrip;
  onSaved: (orderId: string, direction: string) => void;
  onOpenOrder: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { c, scheme } = useAppTheme();
  const { t } = useTranslation();
  const [direction, setDirection] = useState(trip.direction);
  const [isSaving, setIsSaving] = useState(false);

  const isBeilader = trip.cargoType === 'beilader';
  const complete = !isIncomplete(trip);

  const save = async (value: string) => {
    setIsSaving(true);
    try {
      await setOrderDirection(trip.orderId, value);
      const saved = value.trim();
      setDirection(saved);
      onSaved(trip.orderId, saved);
    } catch (error) {
      showAlert(
        t('common', 'error'),
        error instanceof Error ? error.message : t('chefUmsatzliste', 'alertSaveFailed')
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.card, complete && styles.cardComplete]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardDate}>
          {trip.date ? isoToGerman(trip.date) : t('chefUmsatzliste', 'noDate')}
        </Text>
        <Text style={styles.cardPlate}>
          {trip.licensePlate ?? t('chefUmsatzliste', 'noTruck')}
        </Text>
      </View>

      <Text style={styles.cardMeta}>
        {[
          `${t('chefUmsatzliste', 'orderLabel')} ${trip.orderNr}`,
          isBeilader
            ? t('chefUmsatzliste', 'beilader')
            : `${formatKm(trip.freightKm)} km · ${formatKm(trip.emptyKm)} ${t('chefUmsatzliste', 'emptyKm')}`,
        ].join(' · ')}
      </Text>

      <FluidPressable onPress={onOpenOrder} style={styles.priceLine}>
        {trip.price === null ? (
          <Text style={styles.priceMissing}>{t('chefUmsatzliste', 'priceMissing')}</Text>
        ) : (
          <Text style={styles.priceValue}>
            {`${t('chefUmsatzliste', 'priceLabel')}: € ${trip.price.toLocaleString('de-DE', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
          </Text>
        )}
      </FluidPressable>

      {!isBeilader && (
        <>
          <View style={styles.directionRow}>
            <View style={styles.directionField}>
              <Text style={styles.label}>{t('chefUmsatzliste', 'directionLabel')}</Text>
              <TextInput
                placeholderTextColor={c.placeholder}
                keyboardAppearance={scheme}
                style={styles.input}
                value={direction}
                onChangeText={setDirection}
                placeholder={t('chefUmsatzliste', 'directionPlaceholder')}
                editable={!isSaving}
                onSubmitEditing={() => save(direction)}
              />
            </View>
            <FluidPressable
              style={[styles.saveButton, isSaving && styles.buttonDisabled]}
              onPress={() => save(direction)}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {direction.trim() && direction.trim() === trip.direction
                    ? '✓'
                    : t('chefUmsatzliste', 'saveButton')}
                </Text>
              )}
            </FluidPressable>
          </View>

          {/* Ein Tippen auf einen Vorschlag speichert gleich — das ist der
              Normalfall, für "FR - DE" bleibt das Textfeld. */}
          <View style={styles.suggestionRow}>
            {DIRECTION_SUGGESTIONS.map((suggestion) => (
              <FluidPressable
                key={suggestion}
                style={[
                  styles.suggestionChip,
                  trip.direction === suggestion && styles.filterChipActive,
                ]}
                onPress={() => save(suggestion)}
                disabled={isSaving}
              >
                <Text
                  style={[
                    styles.suggestionText,
                    trip.direction === suggestion && styles.filterTextActive,
                  ]}
                >
                  {suggestion}
                </Text>
              </FluidPressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c, scheme } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    section: u.column,
    sectionTitle: {
      ...Typography.title2,
      color: c.text,
      marginBottom: Spacing.xxs,
    },
    hint: {
      ...u.hint,
      marginTop: 0,
      marginBottom: Spacing.sm,
    },
    // Filter als iOS-Pills
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
      marginBottom: Spacing.md,
    },
    filterChip: {
      minHeight: Layout.minTouch,
      justifyContent: 'center',
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      backgroundColor: c.surfaceTertiary,
    },
    filterChipActive: {
      backgroundColor: c.tintFill,
    },
    filterText: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.text,
    },
    filterTextActive: {
      color: c.onTint,
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
    emptyStateText: {
      ...u.emptyStateSubtext,
      fontWeight: '600',
    },
    gridRow: {
      ...u.gridRow,
      flexDirection: 'row',
    },
    card: {
      ...u.gridItem,
      ...u.card,
      marginBottom: Spacing.sm,
      borderLeftWidth: 4,
      borderLeftColor: c.tintFill,
      ...shadow(1, scheme),
    },
    cardComplete: {
      borderLeftColor: c.success,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    cardDate: {
      ...Typography.headline,
      color: c.text,
    },
    cardPlate: {
      ...Typography.footnote,
      fontWeight: '700',
      color: c.tint,
      backgroundColor: c.tintSoft,
      paddingHorizontal: Spacing.xs,
      paddingVertical: 2,
      borderRadius: Radius.sm,
      overflow: 'hidden',
    },
    cardMeta: {
      ...Typography.footnote,
      color: c.textSecondary,
      marginTop: Spacing.xxs,
    },
    input: {
      ...u.input,
      marginBottom: 0,
      paddingHorizontal: Spacing.sm,
      backgroundColor: c.surfaceSecondary,
      borderColor: 'transparent',
      fontVariant: ['tabular-nums'],
    },
    saveButton: {
      ...u.primaryButton,
      minHeight: 48,
      minWidth: 96,
      paddingHorizontal: Spacing.md,
    },
    saveButtonText: u.primaryButtonText,
    buttonDisabled: u.disabled,
    priceLine: {
      alignSelf: 'flex-start',
      minHeight: Layout.minTouch,
      justifyContent: 'center',
      marginBottom: Spacing.xs,
    },
    priceValue: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.text,
      fontVariant: ['tabular-nums'],
    },
    priceMissing: {
      ...Typography.subhead,
      fontWeight: '700',
      color: c.tint,
    },
    directionRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Spacing.xs,
    },
    directionField: {
      flex: 1,
    },
    label: {
      ...Typography.caption2,
      fontWeight: '600',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: Spacing.xxs,
    },
    suggestionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs - 2,
      marginTop: Spacing.sm,
    },
    suggestionChip: {
      minHeight: Layout.minTouch,
      justifyContent: 'center',
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      backgroundColor: c.surfaceTertiary,
    },
    suggestionText: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.text,
    },
  });
};
