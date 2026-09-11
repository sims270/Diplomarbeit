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
import { Colors } from '@/constants/theme';
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
        <ActivityIndicator size="large" color={Colors.ui.primary} />
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
                  style={[styles.input, styles.comboInput]}
                  value={licensePlate}
                  onChangeText={setLicensePlate}
                  placeholder={t('tankliste', 'placeholderLicensePlate')}
                  placeholderTextColor="#9a9a9a"
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
                style={styles.input}
                value={kmStand}
                onChangeText={setKmStand}
                placeholder={t('tankliste', 'placeholderKmStand')}
                placeholderTextColor="#9a9a9a"
                keyboardType="numeric"
              />

              <Text style={styles.label}>{t('tankliste', 'fieldLitersDiesel')}</Text>
              <TextInput
                style={styles.input}
                value={litersDiesel}
                onChangeText={setLitersDiesel}
                placeholder={t('tankliste', 'placeholderLiters')}
                placeholderTextColor="#9a9a9a"
                keyboardType="numeric"
              />

              <Text style={styles.label}>{t('tankliste', 'fieldLitersAdBlue')}</Text>
              <TextInput
                style={styles.input}
                value={litersAdBlue}
                onChangeText={setLitersAdBlue}
                placeholder={t('tankliste', 'placeholderLiters')}
                placeholderTextColor="#9a9a9a"
                keyboardType="numeric"
              />

              <Text style={styles.label}>{t('tankliste', 'fieldFuelStation')}</Text>
              <View style={styles.comboRow}>
                <TextInput
                  style={[styles.input, styles.comboInput]}
                  value={fuelStation}
                  onChangeText={setFuelStation}
                  placeholder={t('tankliste', 'placeholderFuelStation')}
                  placeholderTextColor="#9a9a9a"
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

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('tankliste', 'listTitle')}</Text>

            {isLoadingEntries ? (
              <ActivityIndicator
                style={styles.loading}
                size="large"
                color={Colors.ui.primary}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.lightGray,
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.ui.lightGray,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.ui.darkGray,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: 'white',
    fontSize: 14,
    color: Colors.ui.charcoal,
  },
  comboRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  comboInput: {
    flex: 1,
  },
  comboChevronButton: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    backgroundColor: 'white',
  },
  comboChevron: {
    fontSize: 14,
    color: Colors.ui.darkGray,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  closeButton: {
    fontSize: 24,
    color: Colors.ui.darkGray,
  },
  pickerOption: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: Colors.ui.lightGray,
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.charcoal,
  },
  pickerOptionHint: {
    fontSize: 12,
    color: Colors.ui.darkGray,
    marginTop: 2,
  },
  saveButton: {
    backgroundColor: Colors.ui.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  loading: {
    marginTop: 24,
  },
  emptyState: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ui.darkGray,
  },
  emptyStateSub: {
    fontSize: 13,
    color: Colors.ui.darkGray,
    marginTop: 4,
    textAlign: 'center',
  },
  entryCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: Colors.ui.primary,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  entryDate: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.text,
  },
  entryPlate: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.ui.tertiary,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  entryLabel: {
    fontSize: 13,
    color: Colors.ui.darkGray,
  },
  entryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
  },
});
