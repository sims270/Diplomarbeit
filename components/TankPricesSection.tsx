import { useAuth } from '@/app/context/AuthContext';
import {
  getAllTankEntries,
  parseGermanNumber,
  parseOdometer,
  setTankEntryPrices,
  type TankEntry,
  updateTankEntry,
} from '@/app/services/tankEntryService';
import { DateField } from '@/components/DateField';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Layout, Radius, shadow, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert } from '@/lib/alert';
import { isoToGerman } from '@/lib/dateFormat';
import { plateKey } from '@/lib/plateKey';
import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

/**
 * Die Tankliste aus Sicht des Chefs: Hier trägt er zu jeder Tankung den
 * Preis laut Beleg ein. Steht oben im Tankliste-Tab (app/chef/(tabs)/tank.tsx).
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

export function TankPricesSection({
  action,
  refreshSignal,
  month,
  selectedPlate,
}: {
  /** Steht unter dem Hinweis — im Tab der Button "Tankliste exportieren". */
  action?: ReactNode;
  /** Hochzählen lädt neu (Pull-to-Refresh der ScrollView im Tab). */
  refreshSignal: number;
  /** 'YYYY-MM' — nur Tankungen aus diesem Monat. */
  month: string;
  /** Schlüssel aus lib/plateKey.ts, null = alle Kennzeichen. */
  selectedPlate: string | null;
}) {
  const styles = useThemedStyles(createStyles);
  const { c, columns } = useAppTheme();
  const { t } = useTranslation();
  const { isOfflineMode } = useAuth();

  const [entries, setEntries] = useState<TankEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  // Monat und Kennzeichen aus der Leiste oben im Tab. Die Zahlen in den
  // Filter-Pills beziehen sich auf diese Auswahl.
  const inScope = useMemo(
    () =>
      entries.filter(
        (e) =>
          e.entryDate.startsWith(month) &&
          (selectedPlate === null || plateKey(e.licensePlate) === selectedPlate)
      ),
    [entries, month, selectedPlate]
  );

  const visible = useMemo(
    () => (onlyMissing ? inScope.filter((e) => missingAtLoad.has(e.id)) : inScope),
    [inScope, missingAtLoad, onlyMissing]
  );

  // Kartenraster wie vorher mit FlatList numColumns — die Liste steht jetzt
  // zusammen mit der Umsatzliste in einer ScrollView, da geht keine FlatList.
  const rows = useMemo(() => {
    const out: TankEntry[][] = [];
    for (let i = 0; i < visible.length; i += columns) out.push(visible.slice(i, i + columns));
    return out;
  }, [visible, columns]);

  const missingCount = inScope.filter((e) => !hasAllPrices(e)).length;

  const handleSaved = (updated: TankEntry) =>
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('chefTankliste', 'title')}</Text>
      <Text style={styles.hint}>{t('chefTankliste', 'hint')}</Text>

      {action}

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
            {`${t('chefTankliste', 'filterAll')} (${inScope.length})`}
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
        rows.map((row) => (
          <View key={row[0].id} style={columns > 1 ? styles.gridRow : undefined}>
            {row.map((item) => (
              <PriceRow key={item.id} entry={item} onSaved={handleSaved} />
            ))}
          </View>
        ))
      )}
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
  // Die Eingabe des Fahrers bleibt zugeklappt — ändern muss der Chef sie
  // nur, wenn sich jemand vertippt hat.
  const [isEditing, setIsEditing] = useState(false);
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

      {isEditing ? (
        <EntryEditForm
          entry={entry}
          onCancel={() => setIsEditing(false)}
          onSaved={(updated) => {
            onSaved(updated);
            setIsEditing(false);
          }}
        />
      ) : (
        <FluidPressable style={styles.editLink} onPress={() => setIsEditing(true)}>
          <Text style={styles.editLinkText}>{t('chefTankliste', 'editButton')}</Text>
        </FluidPressable>
      )}

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

/**
 * Die Angaben des Fahrers zu einer Tankung, zum Korrigieren durch den Chef.
 * Dieselben Prüfungen wie beim Erfassen (app/driver/tankliste.tsx), damit
 * eine Korrektur nichts durchlässt, was der Fahrer nicht hätte speichern
 * können.
 */
function EntryEditForm({
  entry,
  onCancel,
  onSaved,
}: {
  entry: TankEntry;
  onCancel: () => void;
  onSaved: (entry: TankEntry) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { c, scheme } = useAppTheme();
  const { t } = useTranslation();
  const [entryDate, setEntryDate] = useState(entry.entryDate);
  const [licensePlate, setLicensePlate] = useState(entry.licensePlate);
  const [kmStand, setKmStand] = useState(String(entry.kmStand));
  const [litersDiesel, setLitersDiesel] = useState(formatInput(entry.litersDiesel, 2));
  const [litersAdBlue, setLitersAdBlue] = useState(formatInput(entry.litersAdBlue, 2));
  const [fuelStation, setFuelStation] = useState(entry.fuelStation);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!entryDate || !licensePlate.trim() || !kmStand.trim() || !litersDiesel.trim()) {
      showAlert(t('common', 'error'), t('tankliste', 'errorRequiredFields'));
      return;
    }

    const parsedKm = parseOdometer(kmStand);
    if (parsedKm === null) {
      showAlert(t('common', 'error'), t('tankliste', 'errorKmStand'));
      return;
    }

    const parsedDiesel = parseGermanNumber(litersDiesel);
    if (parsedDiesel === null || parsedDiesel <= 0) {
      showAlert(t('common', 'error'), t('tankliste', 'errorLitersDiesel'));
      return;
    }

    // Leer heißt "kein AdBlue nachgefüllt", wie beim Fahrer.
    let parsedAdBlue: number | null = null;
    if (litersAdBlue.trim()) {
      parsedAdBlue = parseGermanNumber(litersAdBlue);
      if (parsedAdBlue === null || parsedAdBlue <= 0) {
        showAlert(t('common', 'error'), t('tankliste', 'errorLitersAdBlue'));
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await updateTankEntry(entry.id, {
        entryDate,
        licensePlate,
        kmStand: parsedKm,
        litersDiesel: parsedDiesel,
        litersAdBlue: parsedAdBlue,
        fuelStation,
      });
      onSaved({
        ...entry,
        entryDate,
        licensePlate: licensePlate.trim(),
        kmStand: parsedKm,
        litersDiesel: parsedDiesel,
        litersAdBlue: parsedAdBlue,
        fuelStation: fuelStation.trim(),
        // Ohne AdBlue verwirft die Datenbank auch den AdBlue-Preis.
        priceAdBlue: parsedAdBlue === null ? null : entry.priceAdBlue,
      });
    } catch (error) {
      showAlert(
        t('common', 'error'),
        error instanceof Error ? error.message : t('chefTankliste', 'alertEditFailed')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.editForm}>
      <View style={styles.editGrid}>
        <View style={styles.editField}>
          <Text style={styles.priceLabel}>{t('tankliste', 'fieldDate')}</Text>
          <DateField
            value={entryDate}
            onChange={setEntryDate}
            placeholder={t('tankliste', 'fieldDate')}
          />
        </View>
        <View style={styles.editField}>
          <Text style={styles.priceLabel}>{t('tankliste', 'fieldLicensePlate')}</Text>
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            value={licensePlate}
            onChangeText={setLicensePlate}
            placeholder={t('tankliste', 'placeholderLicensePlate')}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isSubmitting}
          />
        </View>
        <View style={styles.editField}>
          <Text style={styles.priceLabel}>{t('tankliste', 'fieldKmStand')}</Text>
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            value={kmStand}
            onChangeText={setKmStand}
            placeholder={t('tankliste', 'placeholderKmStand')}
            keyboardType="numeric"
            editable={!isSubmitting}
          />
        </View>
        <View style={styles.editField}>
          <Text style={styles.priceLabel}>{t('tankliste', 'fieldLitersDiesel')}</Text>
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            value={litersDiesel}
            onChangeText={setLitersDiesel}
            placeholder={t('tankliste', 'placeholderLiters')}
            keyboardType="decimal-pad"
            editable={!isSubmitting}
          />
        </View>
        <View style={styles.editField}>
          <Text style={styles.priceLabel}>{t('tankliste', 'fieldLitersAdBlue')}</Text>
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            value={litersAdBlue}
            onChangeText={setLitersAdBlue}
            placeholder={t('tankliste', 'placeholderLiters')}
            keyboardType="decimal-pad"
            editable={!isSubmitting}
          />
        </View>
        <View style={styles.editField}>
          <Text style={styles.priceLabel}>{t('tankliste', 'fieldFuelStation')}</Text>
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            value={fuelStation}
            onChangeText={setFuelStation}
            placeholder={t('tankliste', 'placeholderFuelStation')}
            editable={!isSubmitting}
          />
        </View>
      </View>

      <View style={styles.editActions}>
        <FluidPressable style={styles.cancelButton} onPress={onCancel} disabled={isSubmitting}>
          <Text style={styles.cancelButtonText}>{t('chefTankliste', 'editCancel')}</Text>
        </FluidPressable>
        <FluidPressable
          style={[styles.editSaveButton, isSubmitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.saveButtonText}>{t('chefTankliste', 'editSave')}</Text>
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
    editLink: {
      alignSelf: 'flex-start',
      minHeight: Layout.minTouch,
      justifyContent: 'center',
      marginTop: -Spacing.xs,
      marginBottom: Spacing.xs,
    },
    editLinkText: {
      ...Typography.footnote,
      fontWeight: '600',
      color: c.tint,
    },
    editForm: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator,
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    editGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    editField: {
      flexGrow: 1,
      flexBasis: 140,
    },
    editActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: Spacing.xs,
      marginTop: Spacing.sm,
    },
    cancelButton: {
      ...u.secondaryButton,
      minHeight: 48,
      paddingHorizontal: Spacing.md,
    },
    cancelButtonText: u.secondaryButtonText,
    editSaveButton: {
      ...u.primaryButton,
      minHeight: 48,
      paddingHorizontal: Spacing.md,
    },
  });
};
