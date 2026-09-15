import { useAuth } from '@/app/context/AuthContext';
import {
  getAllTankEntries,
  parseGermanNumber,
  setTankEntryPrices,
  type TankEntry,
} from '@/app/services/tankEntryService';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Layout, Radius, shadow, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
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
 * Die Tankliste aus Sicht des Chefs: Hier trägt er zu jeder Tankung den
 * Preis laut Beleg ein.
 *
 * Die Preise gehören in die App und nicht erst in die Excel-Datei: Nur dann
 * enthält jeder Export alles, und die Datei auf dem Rechner des Chefs darf
 * bei jedem Export neu geschrieben werden. Stünden die Preise nur in Excel,
 * ginge mit jedem neuen Export verloren, was dort nachgetragen wurde.
 *
 * Vorgabe ist "Nur ohne Preis" — der Chef will wissen, was noch fehlt, nicht
 * durch alle je erfassten Tankungen scrollen.
 */

// Deutsche Schreibweise zurück ins Eingabefeld. Vier Nachkommastellen beim
// Literpreis, wie sie auf dem Beleg stehen (1,3775).
const formatInput = (value: number | null, digits: number) =>
  value === null
    ? ''
    : value.toLocaleString('de-DE', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
        useGrouping: false,
      });

// Der AdBlue-Preis zählt nur mit, wenn auch AdBlue getankt wurde — sonst
// stünde jede Diesel-Tankung ewig als "ohne Preis" in der Liste.
const hasAllPrices = (entry: TankEntry) =>
  entry.pricePerLiter !== null &&
  entry.priceTotal !== null &&
  (entry.litersAdBlue === null || entry.priceAdBlue !== null);

export default function ChefTanklisteScreen() {
  const styles = useThemedStyles(createStyles);
  const { c, columns } = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { isOfflineMode } = useAuth();

  const [entries, setEntries] = useState<TankEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [onlyMissing, setOnlyMissing] = useState(true);
  // Welche Tankungen beim Laden noch keinen Preis hatten. Der Filter richtet
  // sich danach und nicht nach dem aktuellen Stand: Sonst verschwände eine
  // Zeile im Moment des Speicherns unter dem Finger, und die nächste rückte
  // an ihre Stelle — ein Tippen dort landete dann bei der falschen Tankung.
  const [missingAtLoad, setMissingAtLoad] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoadError(null);

    if (isOfflineMode) {
      setEntries([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const loaded = await getAllTankEntries();
      setEntries(loaded);
      setMissingAtLoad(new Set(loaded.filter((e) => !hasAllPrices(e)).map((e) => e.id)));
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
    () => (onlyMissing ? entries.filter((e) => missingAtLoad.has(e.id)) : entries),
    [entries, missingAtLoad, onlyMissing]
  );

  const missingCount = entries.filter((e) => !hasAllPrices(e)).length;

  const handleSaved = (updated: TankEntry) =>
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('chefTankliste', 'headerSubtitle')} code="CH" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <FluidPressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
          </FluidPressable>

          <Text style={styles.sectionTitle}>{t('chefTankliste', 'title')}</Text>
          <Text style={styles.hint}>{t('chefTankliste', 'hint')}</Text>

          <View style={styles.filterRow}>
            <FluidPressable
              style={[styles.filterChip, onlyMissing && styles.filterChipActive]}
              onPress={() => setOnlyMissing(true)}
            >
              <Text style={[styles.filterText, onlyMissing && styles.filterTextActive]}>
                {`${t('chefTankliste', 'filterMissing')} (${missingCount})`}
              </Text>
            </FluidPressable>
            <FluidPressable
              style={[styles.filterChip, !onlyMissing && styles.filterChipActive]}
              onPress={() => setOnlyMissing(false)}
            >
              <Text style={[styles.filterText, !onlyMissing && styles.filterTextActive]}>
                {`${t('chefTankliste', 'filterAll')} (${entries.length})`}
              </Text>
            </FluidPressable>
          </View>

          {isOfflineMode ? (
            <Text style={styles.errorText}>{t('common', 'offlineModeHint')}</Text>
          ) : isLoading ? (
            <ActivityIndicator style={styles.loading} color={c.tint} />
          ) : loadError !== null ? (
            <>
              <Text style={styles.errorText}>{t('chefTankliste', 'loadFailed')}</Text>
              {!!loadError && <Text style={styles.errorDetail}>{loadError}</Text>}
            </>
          ) : visible.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {onlyMissing
                  ? t('chefTankliste', 'emptyMissing')
                  : t('chefTankliste', 'emptyAll')}
              </Text>
            </View>
          ) : (
            <FlatList
              // Auf Laptop/Desktop als Kartenraster; key erzwingt Neuaufbau beim Spaltenwechsel
              key={`grid-${columns}`}
              numColumns={columns}
              columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
              data={visible}
              keyExtractor={(item) => item.id}
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
              renderItem={({ item }) => <PriceRow entry={item} onSaved={handleSaved} />}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Eine Tankung mit ihren zwei Preisfeldern. Eigener Zustand je Zeile, damit
 * ein halb getippter Preis nicht verloren geht, wenn eine andere Zeile
 * gespeichert wird.
 */
function PriceRow({
  entry,
  onSaved,
}: {
  entry: TankEntry;
  onSaved: (entry: TankEntry) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { c, scheme } = useAppTheme();
  const { t } = useTranslation();
  const [priceAdBlue, setPriceAdBlue] = useState(formatInput(entry.priceAdBlue, 2));
  const [pricePerLiter, setPricePerLiter] = useState(formatInput(entry.pricePerLiter, 4));
  const [priceTotal, setPriceTotal] = useState(formatInput(entry.priceTotal, 2));
  const [isSaving, setIsSaving] = useState(false);

  const complete = hasAllPrices(entry);

  const handleSave = async () => {
    // Leer heißt "noch nicht eingetragen" und bleibt erlaubt — der Chef hat
    // manchmal nur den Gesamtbetrag vom Beleg. Steht aber etwas drin, muss
    // es eine gültige, positive Zahl sein.
    const parse = (raw: string): number | null | 'invalid' => {
      if (!raw.trim()) return null;
      const value = parseGermanNumber(raw);
      return value === null || value <= 0 ? 'invalid' : value;
    };

    // Ohne AdBlue gibt es das Feld gar nicht — dann wird auch nichts
    // mitgeschickt, egal was vorher einmal drinstand.
    const adBlue = entry.litersAdBlue === null ? null : parse(priceAdBlue);
    const perLiter = parse(pricePerLiter);
    const total = parse(priceTotal);

    if (adBlue === 'invalid' || perLiter === 'invalid' || total === 'invalid') {
      showAlert(t('common', 'error'), t('chefTankliste', 'alertInvalidPrice'));
      return;
    }

    setIsSaving(true);
    try {
      await setTankEntryPrices(entry.id, {
        priceAdBlue: adBlue,
        pricePerLiter: perLiter,
        priceTotal: total,
      });
      onSaved({ ...entry, priceAdBlue: adBlue, pricePerLiter: perLiter, priceTotal: total });
      setPriceAdBlue(formatInput(adBlue, 2));
      setPricePerLiter(formatInput(perLiter, 4));
      setPriceTotal(formatInput(total, 2));
    } catch (error) {
      showAlert(
        t('common', 'error'),
        error instanceof Error ? error.message : t('chefTankliste', 'alertSaveFailed')
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.card, complete && styles.cardComplete]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardDate}>{isoToGerman(entry.entryDate)}</Text>
        <Text style={styles.cardPlate}>{entry.licensePlate}</Text>
      </View>

      <Text style={styles.cardMeta}>
        {[
          entry.fuelStation,
          `${entry.litersDiesel.toLocaleString('de-DE')} l ${t('chefTankliste', 'diesel')}`,
          entry.litersAdBlue === null
            ? null
            : `${entry.litersAdBlue.toLocaleString('de-DE')} l AdBlue`,
          `${entry.kmStand.toLocaleString('de-DE')} km`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>

      <View style={styles.priceRow}>
        {/* Reihenfolge wie in der Excel-Datei: AdBlue-Preis steht dort
            direkt hinter den AdBlue-Litern, vor den Diesel-Preisen. */}
        {entry.litersAdBlue !== null && (
          <View style={styles.priceField}>
            <Text style={styles.priceLabel}>{t('chefTankliste', 'priceAdBlueLabel')}</Text>
            <TextInput
              placeholderTextColor={c.placeholder}
              keyboardAppearance={scheme}
              style={styles.input}
              value={priceAdBlue}
              onChangeText={setPriceAdBlue}
              placeholder="0,00"
              keyboardType="decimal-pad"
              editable={!isSaving}
            />
          </View>
        )}
        <View style={styles.priceField}>
          <Text style={styles.priceLabel}>{t('chefTankliste', 'pricePerLiterLabel')}</Text>
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            value={pricePerLiter}
            onChangeText={setPricePerLiter}
            placeholder="1,3775"
            keyboardType="decimal-pad"
            editable={!isSaving}
          />
        </View>
        <View style={styles.priceField}>
          <Text style={styles.priceLabel}>{t('chefTankliste', 'priceTotalLabel')}</Text>
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            value={priceTotal}
            onChangeText={setPriceTotal}
            placeholder="567,43"
            keyboardType="decimal-pad"
            editable={!isSaving}
          />
        </View>
        <FluidPressable
          style={[styles.saveButton, isSaving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.saveButtonText}>
              {complete ? '✓' : t('chefTankliste', 'saveButton')}
            </Text>
          )}
        </FluidPressable>
      </View>
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
    gridRow: u.gridRow,
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
      marginBottom: Spacing.sm,
    },
    priceRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-end',
      gap: Spacing.xs,
    },
    priceField: {
      flex: 1,
      // Mit AdBlue sind es drei Felder plus Button — am Handy bricht die Zeile
      // dann um, statt die Felder unlesbar schmal zu drücken.
      minWidth: 110,
    },
    priceLabel: {
      ...Typography.caption2,
      fontWeight: '600',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: Spacing.xxs,
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
  });
};
