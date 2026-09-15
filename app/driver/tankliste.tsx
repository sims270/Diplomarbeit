import { useAuth } from '@/app/context/AuthContext';
import {
  createTankEntry,
  getTankEntriesByDriver,
  parseGermanNumber,
  parseOdometer,
  type TankEntry,
} from '@/app/services/tankEntryService';
import { DateField } from '@/components/DateField';
import { BlurSurface } from '@/components/fluid/BlurSurface';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Radius, shadow, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert } from '@/lib/alert';
import { dateToIso, isoToGerman } from '@/lib/dateFormat';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// Die Tankstellen, an denen die Fahrer regelmäßig tanken. Bewusst eine
// offene Liste: das Feld bleibt frei beschreibbar, damit eine
// Fremdtankung unterwegs nicht am Dropdown scheitert.
const FUEL_STATION_OPTIONS = [
  'Diesel 24, Traboch',
  'Liegl, Ort im Innkreis',
  'Diesel 24, Ort im Innkreis',
  'Honisch, Arnsberg',
];

/**
 * Tankliste des Fahrers — ersetzt den Papierzettel im LKW. Erfassen und
 * eigene Einträge ansehen; ändern oder löschen ist bewusst nicht
 * vorgesehen (vgl. die fehlenden UPDATE-/DELETE-Policies in der
 * Migration).
 */
export default function DriverTankListeScreen() {
  const styles = useThemedStyles(createStyles);
  const { c, scheme } = useAppTheme();
  const { user, isLoading, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();

  const [entries, setEntries] = useState<TankEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [entryDate, setEntryDate] = useState(dateToIso(new Date()));
  const [licensePlate, setLicensePlate] = useState('');
  const [kmStand, setKmStand] = useState('');
  const [litersDiesel, setLitersDiesel] = useState('');
  const [litersAdBlue, setLitersAdBlue] = useState('');
  const [fuelStation, setFuelStation] = useState('');
  const [isStationPickerOpen, setIsStationPickerOpen] = useState(false);
  const [isPlatePickerOpen, setIsPlatePickerOpen] = useState(false);

  // Der vom Chef zugeteilte LKW steht beim Öffnen schon im Feld — das ist
  // der Normalfall und spart das Abtippen, das auf dem Papierzettel die
  // Fehlerquelle war. Überschrieben wird nie: Hat der Fahrer bereits etwas
  // eingetragen, bleibt das stehen.
  const assignedPlate = user?.licensePlate ?? '';
  useEffect(() => {
    if (assignedPlate) setLicensePlate((prev) => prev || assignedPlate);
  }, [assignedPlate]);

  // Zur Auswahl stehen der zugeteilte LKW und jeder andere, den dieser
  // Fahrer schon einmal getankt hat — fährt er öfter denselben Ersatz-LKW,
  // steht der ab der zweiten Tankung von allein in der Liste.
  const plateOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: string[] = [];
    for (const plate of [assignedPlate, ...entries.map((e) => e.licensePlate)]) {
      const value = plate?.trim();
      if (!value || seen.has(value.toUpperCase())) continue;
      seen.add(value.toUpperCase());
      options.push(value);
    }
    return options;
  }, [assignedPlate, entries]);

  const loadEntries = useCallback(async () => {
    if (!user?.id) return;
    setIsLoadingEntries(true);
    try {
      setEntries(await getTankEntriesByDriver(user.id));
    } catch {
      // Wie im Fahrer-Dashboard: die Liste ist eine Übersicht, kein
      // Grund das Formular darüber unbenutzbar zu machen.
      setEntries([]);
    } finally {
      setIsLoadingEntries(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [loadEntries])
  );

  const resetForm = () => {
    setEntryDate(dateToIso(new Date()));
    // Kennzeichen bleibt stehen: derselbe Fahrer tankt in aller Regel
    // denselben LKW, und Abtippen ist genau die Fehlerquelle, die der
    // Zettel schon hatte.
    setKmStand('');
    setLitersDiesel('');
    setLitersAdBlue('');
    setFuelStation('');
  };

  const handleSave = async () => {
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

    // AdBlue ist optional — leer heißt "nicht nachgefüllt" (der Strich auf
    // dem Zettel). Steht aber etwas drin, muss es eine gültige Zahl sein,
    // sonst ginge ein Tippfehler stillschweigend als "nicht nachgefüllt"
    // durch.
    let parsedAdBlue: number | null = null;
    if (litersAdBlue.trim()) {
      parsedAdBlue = parseGermanNumber(litersAdBlue);
      if (parsedAdBlue === null || parsedAdBlue <= 0) {
        showAlert(t('common', 'error'), t('tankliste', 'errorLitersAdBlue'));
        return;
      }
    }

    setIsSaving(true);
    try {
      await createTankEntry({
        entryDate,
        licensePlate,
        kmStand: parsedKm,
        litersDiesel: parsedDiesel,
        litersAdBlue: parsedAdBlue,
        fuelStation,
      });
      resetForm();
      await loadEntries();
      showAlert(t('common', 'success'), t('tankliste', 'saveSuccess'));
    } catch (error) {
      showAlert(
        t('common', 'error'),
        error instanceof Error ? error.message : t('tankliste', 'saveError')
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={c.tint} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('tankliste', 'headerSubtitle')} code="DR" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Laptop/Desktop: zwei Spalten nebeneinander */}
          <View style={styles.pair}>
            <View style={styles.pairItem}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('tankliste', 'formTitle')}</Text>

                <View style={styles.card}>
                  <Text style={styles.label}>{t('tankliste', 'fieldDate')}</Text>
                  <DateField
                    value={entryDate}
                    onChange={setEntryDate}
                    placeholder={t('tankliste', 'fieldDate')}
                  />

                  <Text style={styles.label}>{t('tankliste', 'fieldLicensePlate')}</Text>
                  <View style={styles.comboRow}>
                    <TextInput
                      placeholderTextColor={c.placeholder}
                      keyboardAppearance={scheme}
                      style={[styles.input, styles.comboInput]}
                      value={licensePlate}
                      onChangeText={setLicensePlate}
                      placeholder={t('tankliste', 'placeholderLicensePlate')}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                    {plateOptions.length > 0 && (
                      <FluidPressable
                        style={styles.comboChevronButton}
                        onPress={() => setIsPlatePickerOpen(true)}
                      >
                        <Text style={styles.comboChevron}>▾</Text>
                      </FluidPressable>
                    )}
                  </View>

                  <Text style={styles.label}>{t('tankliste', 'fieldKmStand')}</Text>
                  <TextInput
                    placeholderTextColor={c.placeholder}
                    keyboardAppearance={scheme}
                    style={styles.input}
                    value={kmStand}
                    onChangeText={setKmStand}
                    placeholder={t('tankliste', 'placeholderKmStand')}
                    keyboardType="numeric"
                  />

                  <Text style={styles.label}>{t('tankliste', 'fieldLitersDiesel')}</Text>
                  <TextInput
                    placeholderTextColor={c.placeholder}
                    keyboardAppearance={scheme}
                    style={styles.input}
                    value={litersDiesel}
                    onChangeText={setLitersDiesel}
                    placeholder={t('tankliste', 'placeholderLiters')}
                    keyboardType="numeric"
                  />

                  <Text style={styles.label}>{t('tankliste', 'fieldLitersAdBlue')}</Text>
                  <TextInput
                    placeholderTextColor={c.placeholder}
                    keyboardAppearance={scheme}
                    style={styles.input}
                    value={litersAdBlue}
                    onChangeText={setLitersAdBlue}
                    placeholder={t('tankliste', 'placeholderLiters')}
                    keyboardType="numeric"
                  />

                  <Text style={styles.label}>{t('tankliste', 'fieldFuelStation')}</Text>
                  <View style={styles.comboRow}>
                    <TextInput
                      placeholderTextColor={c.placeholder}
                      keyboardAppearance={scheme}
                      style={[styles.input, styles.comboInput]}
                      value={fuelStation}
                      onChangeText={setFuelStation}
                      placeholder={t('tankliste', 'placeholderFuelStation')}
                    />
                    <FluidPressable
                      style={styles.comboChevronButton}
                      onPress={() => setIsStationPickerOpen(true)}
                    >
                      <Text style={styles.comboChevron}>▾</Text>
                    </FluidPressable>
                  </View>

                  <FluidPressable
                    style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.saveButtonText}>{t('tankliste', 'saveButton')}</Text>
                    )}
                  </FluidPressable>
            </View>
          </View>

            </View>
            <View style={styles.pairItem}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('tankliste', 'listTitle')}</Text>

            {isLoadingEntries ? (
              <ActivityIndicator
                style={styles.loading}
                size="large"
                color={c.tint}
              />
            ) : entries.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>{t('tankliste', 'emptyTitle')}</Text>
                <Text style={styles.emptyStateSub}>{t('tankliste', 'emptySubtitle')}</Text>
              </View>
            ) : (
              entries.map((entry) => (
                <View key={entry.id} style={styles.entryCard}>
                  <View style={styles.entryHeader}>
                    <Text style={styles.entryDate}>{isoToGerman(entry.entryDate)}</Text>
                    <Text style={styles.entryPlate}>{entry.licensePlate}</Text>
                  </View>

                  <View style={styles.entryRow}>
                    <Text style={styles.entryLabel}>{t('tankliste', 'fieldKmStand')}</Text>
                    <Text style={styles.entryValue}>
                      {entry.kmStand.toLocaleString('de-DE')} km
                    </Text>
                  </View>

                  <View style={styles.entryRow}>
                    <Text style={styles.entryLabel}>{t('tankliste', 'fieldLitersDiesel')}</Text>
                    <Text style={styles.entryValue}>
                      {entry.litersDiesel.toLocaleString('de-DE')} l
                    </Text>
                  </View>

                  <View style={styles.entryRow}>
                    <Text style={styles.entryLabel}>{t('tankliste', 'fieldLitersAdBlue')}</Text>
                    <Text style={styles.entryValue}>
                      {entry.litersAdBlue === null
                        ? '—'
                        : `${entry.litersAdBlue.toLocaleString('de-DE')} l`}
                    </Text>
                  </View>

                  <View style={styles.entryRow}>
                    <Text style={styles.entryLabel}>{t('tankliste', 'fieldFuelStation')}</Text>
                    <Text style={styles.entryValue}>{entry.fuelStation || '—'}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={isPlatePickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPlatePickerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurSurface
            intensity={30}
            tint="dark"
            fallbackColor="rgba(0,0,0,0.6)"
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('tankliste', 'fieldLicensePlate')}</Text>
              <FluidPressable onPress={() => setIsPlatePickerOpen(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </FluidPressable>
            </View>
            <FlatList
              data={plateOptions}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <FluidPressable
                  style={styles.pickerOption}
                  onPress={() => {
                    setLicensePlate(item);
                    setIsPlatePickerOpen(false);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{item}</Text>
                  {item === assignedPlate && (
                    <Text style={styles.pickerOptionHint}>
                      {t('tankliste', 'assignedPlateHint')}
                    </Text>
                  )}
                </FluidPressable>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={isStationPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsStationPickerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurSurface
            intensity={30}
            tint="dark"
            fallbackColor="rgba(0,0,0,0.6)"
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('tankliste', 'fieldFuelStation')}</Text>
              <FluidPressable onPress={() => setIsStationPickerOpen(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </FluidPressable>
            </View>
            <FlatList
              data={FUEL_STATION_OPTIONS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <FluidPressable
                  style={styles.pickerOption}
                  onPress={() => {
                    setFuelStation(item);
                    setIsStationPickerOpen(false);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{item}</Text>
                </FluidPressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c, scheme, isDesktop } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    // Laptop/Desktop: Erfassen links, Liste rechts — die Spalte liegt dann am Wrapper
    pair: isDesktop ? { ...u.column, ...u.pair } : {},
    pairItem: u.pairItem,
    container: u.screen,
    flex: {
      flex: 1,
    },
    loadingContainer: {
      ...u.screen,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      flex: 1,
    },
    section: isDesktop
      ? { paddingBottom: Spacing.xs }
      : { ...u.column, paddingBottom: Spacing.xs },
    sectionTitle: {
      ...Typography.title2,
      color: c.text,
      marginBottom: Spacing.sm,
    },
    card: u.card,
    // Feldbezeichnung über dem Eingabefeld
    label: {
      ...Typography.caption1,
      fontWeight: '600',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: Spacing.xs - 2,
      marginTop: Spacing.xxs,
    },
    // In Karten: grau gefüllte Felder ohne Rahmen, wie in iOS-Formularen
    input: {
      ...u.input,
      backgroundColor: c.surfaceSecondary,
      borderColor: 'transparent',
    },
    comboRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.xs,
    },
    comboInput: {
      flex: 1,
    },
    comboChevronButton: {
      ...u.field,
      width: 48,
      paddingHorizontal: 0,
      justifyContent: 'center',
      backgroundColor: c.surfaceSecondary,
      borderColor: 'transparent',
    },
    comboChevron: u.chevron,
    modalOverlay: u.modalOverlay,
    modalContent: u.modalSheet,
    modalHeader: u.modalHeader,
    modalTitle: u.modalTitle,
    closeButton: u.closeButton,
    pickerOption: u.option,
    pickerOptionText: u.optionText,
    pickerOptionHint: u.optionSubtext,
    saveButton: {
      ...u.primaryButton,
      marginTop: Spacing.sm,
    },
    saveButtonDisabled: u.disabled,
    saveButtonText: u.primaryButtonText,
    loading: {
      marginTop: Spacing.lg,
    },
    emptyState: u.emptyState,
    emptyStateText: u.emptyStateText,
    emptyStateSub: u.emptyStateSubtext,
    entryCard: {
      ...u.card,
      marginBottom: Spacing.sm,
      borderLeftWidth: 4,
      borderLeftColor: c.tintFill,
      ...shadow(1, scheme),
    },
    entryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    entryDate: {
      ...Typography.headline,
      color: c.text,
    },
    entryPlate: {
      ...Typography.footnote,
      fontWeight: '700',
      color: c.tint,
      backgroundColor: c.tintSoft,
      paddingHorizontal: Spacing.xs,
      paddingVertical: 2,
      borderRadius: Radius.sm,
      overflow: 'hidden',
    },
    entryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: Spacing.md,
      paddingVertical: Spacing.xxs,
    },
    entryLabel: {
      ...Typography.subhead,
      color: c.textSecondary,
    },
    entryValue: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.text,
      flexShrink: 1,
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
    },
  });
};
