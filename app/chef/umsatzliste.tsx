import { useAuth } from '@/app/context/AuthContext';
import {
  DIRECTION_SUGGESTIONS,
  getRevenueTrips,
  setOrderDirection,
  type RevenueTrip,
} from '@/app/services/revenueListService';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Colors } from '@/constants/theme';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert } from '@/lib/alert';
import { isoToGerman } from '@/lib/dateFormat';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
 * Die Umsatzliste aus Sicht des Chefs: Hier trägt er zu jeder erledigten
 * Komplettladung die Richtung ein ("hin", "her", "FR - DE") — dasselbe
 * Prinzip wie die Preise in der Tankliste (app/chef/tankliste.tsx). Nur was
 * in der App steht, landet in jedem Export; in Excel Nachgetragenes ginge
 * beim nächsten Export verloren.
 *
 * Beilader haben in der Liste nur einen Betrag, also hier auch kein
 * Richtungsfeld. Fehlt einer Fahrt der Preis, führt ein Tippen zum Auftrag,
 * wo der Chef ihn in der Rechnung einträgt.
 */

const needsDirection = (trip: RevenueTrip) =>
  trip.cargoType === 'komplett' && !trip.direction.trim();

const isIncomplete = (trip: RevenueTrip) => needsDirection(trip) || trip.price === null;

const formatKm = (km: number | null) => (km === null ? '–' : km.toLocaleString('de-DE'));

export default function ChefUmsatzlisteScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isOfflineMode } = useAuth();

  const [trips, setTrips] = useState<RevenueTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
      setIsRefreshing(false);
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
      setIsRefreshing(false);
    }
  }, [isOfflineMode]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      load();
    }, [load])
  );

  const visible = useMemo(
    () => (onlyMissing ? trips.filter((trip) => missingAtLoad.has(trip.orderId)) : trips),
    [trips, missingAtLoad, onlyMissing]
  );

  const missingCount = trips.filter(isIncomplete).length;

  const handleSaved = (orderId: string, direction: string) =>
    setTrips((prev) =>
      prev.map((trip) => (trip.orderId === orderId ? { ...trip, direction } : trip))
    );

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('chefUmsatzliste', 'headerSubtitle')} code="CH" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <FluidPressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
          </FluidPressable>

          <Text style={styles.sectionTitle}>{t('chefUmsatzliste', 'title')}</Text>
          <Text style={styles.hint}>{t('chefUmsatzliste', 'hint')}</Text>

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
                {`${t('chefUmsatzliste', 'filterAll')} (${trips.length})`}
              </Text>
            </FluidPressable>
          </View>

          {isOfflineMode ? (
            <Text style={styles.errorText}>{t('common', 'offlineModeHint')}</Text>
          ) : isLoading ? (
            <ActivityIndicator style={styles.loading} color={Colors.ui.primary} />
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
            <FlatList
              data={visible}
              keyExtractor={(item) => item.orderId}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={() => {
                    setIsRefreshing(true);
                    load();
                  }}
                />
              }
              renderItem={({ item }) => (
                <TripRow
                  trip={item}
                  onSaved={handleSaved}
                  onOpenOrder={() =>
                    router.push({ pathname: '/chef/order/[id]', params: { id: item.orderId } })
                  }
                />
              )}
            />
          )}
        </View>
      </KeyboardAvoidingView>
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
                style={styles.input}
                value={direction}
                onChangeText={setDirection}
                placeholder={t('chefUmsatzliste', 'directionPlaceholder')}
                placeholderTextColor="#9a9a9a"
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.lightGray,
  },
  flex: {
    flex: 1,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    color: Colors.ui.darkGray,
    lineHeight: 17,
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'white',
  },
  filterChipActive: {
    backgroundColor: Colors.ui.primary,
    borderColor: Colors.ui.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.charcoal,
  },
  filterTextActive: {
    color: 'white',
  },
  loading: {
    marginTop: 24,
  },
  errorText: {
    fontSize: 13,
    color: Colors.ui.darkGray,
    lineHeight: 18,
  },
  errorDetail: {
    fontSize: 12,
    color: Colors.ui.darkGray,
    marginTop: 6,
    fontStyle: 'italic',
  },
  emptyState: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.darkGray,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: Colors.ui.primary,
  },
  cardComplete: {
    borderLeftColor: Colors.ui.green,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDate: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.text,
  },
  cardPlate: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.ui.tertiary,
  },
  cardMeta: {
    fontSize: 12,
    color: Colors.ui.darkGray,
    marginTop: 4,
  },
  priceLine: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 10,
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.charcoal,
  },
  priceMissing: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.ui.primary,
  },
  directionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  directionField: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.ui.darkGray,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: Colors.ui.charcoal,
    backgroundColor: 'white',
  },
  saveButton: {
    backgroundColor: Colors.ui.primary,
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    minWidth: 90,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  suggestionChip: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'white',
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.ui.charcoal,
  },
});
