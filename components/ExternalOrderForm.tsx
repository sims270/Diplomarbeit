import type { ExternalOrderFields } from '@/app/services/externalOrderService';
import {
  addCarrierCompanyIfNew,
  getCarrierCompanies,
  type CarrierCompany,
} from '@/app/services/carrierCompanyService';
import {
  addSiteCompanyIfNew,
  formatSiteCompany,
  getSiteCompanies,
  type SiteCompany,
} from '@/app/services/siteCompanyService';
import { addUnloadingCompanyIfNew, getUnloadingCompanies } from '@/app/services/unloadingCompanyService';
import { DateField } from '@/components/DateField';
import { TimeField } from '@/components/TimeField';
import { BlurSurface } from '@/components/fluid/BlurSurface';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Colors } from '@/constants/theme';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert } from '@/lib/alert';
import { PAYMENT_TERMS_OPTIONS, VEHICLE_TYPE_OPTIONS } from '@/lib/transportauftragPdf';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type PickerField =
  | 'vehicleType'
  | 'paymentTerms'
  | 'recipientCompany'
  | 'loadingCompany'
  | 'unloadingCompany';

const emptyFields: ExternalOrderFields = {
  createdBy: '',
  orderNr: '',
  recipientCompany: '',
  recipientAddress: '',
  recipientContact: '',
  loadingDate: '',
  loadingTimeFrom: '',
  loadingTimeUntil: '',
  loadingCompany: '',
  loadingAddress: '',
  loadingNumber: '',
  cargoDescription: '',
  loadingMeters: '',
  unloadingDate: '',
  unloadingTimeFrom: '',
  unloadingTimeUntil: '',
  unloadingCompany: '',
  unloadingAddress: '',
  freightRate: '0,00',
  deadlineSurcharge: '0,00',
  paymentTerms: PAYMENT_TERMS_OPTIONS[0],
  vehicleType: '',
  notes: '',
  licensePlate: '',
  driverName: '',
};

interface ExternalOrderFormProps {
  initialValues?: Partial<ExternalOrderFields>;
  submitLabel: string;
  onSubmit: (fields: ExternalOrderFields) => Promise<void>;
}

// Shared by app/chef/external-order/new.tsx (create) and [id].tsx (edit) —
// all the field UI and validation lives here; each screen only supplies
// starting values and what "submit" actually does (create vs. update).
export function ExternalOrderForm({ initialValues, submitLabel, onSubmit }: ExternalOrderFormProps) {
  const { t } = useTranslation();

  const [form, setForm] = useState<ExternalOrderFields>({ ...emptyFields, ...initialValues });
  const [carrierCompanies, setCarrierCompanies] = useState<CarrierCompany[]>([]);
  const [siteCompanies, setSiteCompanies] = useState<SiteCompany[]>([]);
  const [unloadingCompanies, setUnloadingCompanies] = useState<string[]>([]);
  const [activePicker, setActivePicker] = useState<PickerField | null>(null);
  const [companySearch, setCompanySearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getCarrierCompanies().then(setCarrierCompanies);
    getSiteCompanies().then(setSiteCompanies);
    getUnloadingCompanies().then(setUnloadingCompanies);
  }, []);

  const set = (field: keyof ExternalOrderFields) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Ladung und Entladung ziehen aus zwei getrennten Listen: an der
  // Ladestelle die importierten Kundenfirmen samt Adresse, an der
  // Entladestelle die selbst gewachsene Liste ohne Adresse.
  //
  // An der Ladestelle ist ein Eintrag ein Standort, keine Firma: Dieselbe
  // Firma steht mehrfach in der Liste, wenn sie mehrere Werke hat. Deshalb
  // ist die Liste durchgehend {name, address} — die Adresse gehört sichtbar
  // dazu, sonst stünden mehrere Zeilen da, die gleich aussehen und
  // Verschiedenes bedeuten. Bei allen anderen Pickern bleibt sie leer.
  const toOptions = (values: string[]): SiteCompany[] =>
    values.map((name) => ({ name, address: '' }));

  const pickerOptions: SiteCompany[] =
    activePicker === 'vehicleType'
      ? toOptions(VEHICLE_TYPE_OPTIONS)
      : activePicker === 'paymentTerms'
        ? toOptions(PAYMENT_TERMS_OPTIONS)
        : activePicker === 'recipientCompany'
          ? carrierCompanies
          : activePicker === 'unloadingCompany'
            ? toOptions(unloadingCompanies)
            : siteCompanies;
  const pickerTitle =
    activePicker === 'vehicleType'
      ? t('chefExternalOrder', 'vehicleTypeLabel')
      : activePicker === 'paymentTerms'
        ? t('chefExternalOrder', 'paymentTermsLabel')
        : t('chefExternalOrder', 'companyLabel');
  const isClosedListPicker = activePicker === 'vehicleType' || activePicker === 'paymentTerms';

  // Durchsucht werden die beiden gewachsenen Firmenlisten — Ladestellen
  // und Frächter. Gesucht wird überall in Name und Adresse: Ein
  // eingetippter Teil genügt, der Anfang muss es nicht sein, und über den
  // Ort findet sich der richtige Standort. Bei Transportmittel,
  // Zahlungskonditionen und Entladefirmen bleibt die Suche aus: Die Listen
  // sind kurz genug, ein Suchfeld wäre dort nur im Weg.
  const isSearchablePicker =
    activePicker === 'loadingCompany' || activePicker === 'recipientCompany';
  const query = companySearch.trim().toLowerCase();
  const visibleOptions =
    isSearchablePicker && query
      ? pickerOptions.filter((option) =>
          formatSiteCompany(option).toLowerCase().includes(query)
        )
      : pickerOptions;

  const openPicker = (field: PickerField) => {
    setCompanySearch('');
    setActivePicker(field);
  };

  // Mit einem Ladestellen-Standort kommt gleich seine Adresse ins Formular.
  // Sie steckt im gewählten Eintrag selbst — nachschlagen über den Namen
  // ginge hier fehl, denn bei mehreren Werken derselben Firma träfe man
  // irgendeines davon. Ist keine Adresse hinterlegt, bleibt stehen, was
  // schon im Feld steht, statt es zu leeren. Die Entladeadresse wird immer
  // von Hand eingetragen.
  const pickOption = (option: SiteCompany) => {
    const field = activePicker as PickerField;
    setForm((prev) => {
      const next = { ...prev, [field]: option.name };
      if (option.address) {
        // Beim Empfänger dieselbe Bequemlichkeit wie an der Ladestelle:
        // Die hinterlegte Geschäftsanschrift des Frächters geht direkt ins
        // Adressfeld, das auf dem Transportauftrag unter "An Firma" steht.
        if (field === 'loadingCompany') next.loadingAddress = option.address;
        if (field === 'recipientCompany') next.recipientAddress = option.address;
      }
      return next;
    });
    setActivePicker(null);
  };

  const handleSubmit = async () => {
    const {
      recipientCompany, loadingDate, loadingCompany, loadingAddress,
      unloadingDate, unloadingCompany, unloadingAddress, cargoDescription, vehicleType,
    } = form;

    if (
      !recipientCompany.trim() || !loadingDate.trim() || !loadingCompany.trim() || !loadingAddress.trim() ||
      !unloadingDate.trim() || !unloadingCompany.trim() || !unloadingAddress.trim() || !cargoDescription.trim() ||
      !vehicleType.trim()
    ) {
      showAlert(t('common', 'error'), t('chefExternalOrder', 'alertFillFields'));
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit(form);

      // Best-effort, after the fact: remembers freshly typed companies for
      // next time's dropdowns. Never blocks saving if it fails (see
      // service) — fire-and-forget so it can't delay navigating back.
      addCarrierCompanyIfNew(form.recipientCompany, form.recipientAddress);
      addSiteCompanyIfNew(form.loadingCompany, form.loadingAddress);
      addUnloadingCompanyIfNew(form.unloadingCompany);
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      showAlert(t('common', 'error'), message || t('chefExternalOrder', 'alertPdfFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Text style={styles.hint}>{t('chefExternalOrder', 'hint')}</Text>

      <Text style={styles.sectionTitle}>{t('chefExternalOrder', 'orderNrLabel')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('chefExternalOrder', 'orderNrPlaceholder')}
        value={form.orderNr}
        onChangeText={set('orderNr')}
        keyboardType="numeric"
      />

      <Text style={styles.sectionTitle}>{t('chefExternalOrder', 'recipientSection')}</Text>
      <View style={styles.comboRow}>
        <TextInput
          style={[styles.input, styles.comboInput]}
          placeholder={t('chefExternalOrder', 'recipientCompanyLabel')}
          value={form.recipientCompany}
          onChangeText={set('recipientCompany')}
        />
        <FluidPressable
          style={styles.comboChevronButton}
          onPress={() => openPicker('recipientCompany')}
        >
          <Text style={styles.selectChevron}>▾</Text>
        </FluidPressable>
      </View>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder={t('chefExternalOrder', 'recipientAddressLabel')}
        value={form.recipientAddress}
        onChangeText={set('recipientAddress')}
        multiline
      />
      <TextInput
        style={styles.input}
        placeholder={t('chefExternalOrder', 'recipientContactLabel')}
        value={form.recipientContact}
        onChangeText={set('recipientContact')}
      />

      <Text style={styles.sectionTitle}>{t('chefExternalOrder', 'loadingSection')}</Text>
      <DateField
        value={form.loadingDate}
        onChange={set('loadingDate')}
        placeholder={t('chefExternalOrder', 'dateLabel')}
      />
      <View style={styles.timeRow}>
        <View style={styles.timeInput}>
          <TimeField
            value={form.loadingTimeFrom}
            onChange={set('loadingTimeFrom')}
            placeholder={t('chefExternalOrder', 'timeFromLabel')}
          />
        </View>
        <View style={styles.timeInput}>
          <TimeField
            value={form.loadingTimeUntil}
            onChange={set('loadingTimeUntil')}
            placeholder={t('chefExternalOrder', 'timeUntilLabel')}
          />
        </View>
      </View>
      <View style={styles.comboRow}>
        <TextInput
          style={[styles.input, styles.comboInput]}
          placeholder={t('chefExternalOrder', 'companyLabel')}
          value={form.loadingCompany}
          onChangeText={set('loadingCompany')}
        />
        <FluidPressable
          style={styles.comboChevronButton}
          onPress={() => openPicker('loadingCompany')}
        >
          <Text style={styles.selectChevron}>▾</Text>
        </FluidPressable>
      </View>
      <TextInput
        style={styles.input}
        placeholder={t('chefExternalOrder', 'addressLabel')}
        value={form.loadingAddress}
        onChangeText={set('loadingAddress')}
      />
      <TextInput
        style={styles.input}
        placeholder={t('chefExternalOrder', 'loadingNumberLabel')}
        value={form.loadingNumber}
        onChangeText={set('loadingNumber')}
      />
      <TextInput
        style={styles.input}
        placeholder={t('chefExternalOrder', 'cargoDescriptionLabel')}
        value={form.cargoDescription}
        onChangeText={set('cargoDescription')}
      />
      <TextInput
        style={styles.input}
        placeholder={t('chefExternalOrder', 'loadingMetersLabel')}
        value={form.loadingMeters}
        onChangeText={set('loadingMeters')}
      />

      <Text style={styles.sectionTitle}>{t('chefExternalOrder', 'unloadingSection')}</Text>
      <DateField
        value={form.unloadingDate}
        onChange={set('unloadingDate')}
        placeholder={t('chefExternalOrder', 'dateLabel')}
      />
      <View style={styles.timeRow}>
        <View style={styles.timeInput}>
          <TimeField
            value={form.unloadingTimeFrom}
            onChange={set('unloadingTimeFrom')}
            placeholder={t('chefExternalOrder', 'timeFromLabel')}
          />
        </View>
        <View style={styles.timeInput}>
          <TimeField
            value={form.unloadingTimeUntil}
            onChange={set('unloadingTimeUntil')}
            placeholder={t('chefExternalOrder', 'timeUntilLabel')}
          />
        </View>
      </View>
      <View style={styles.comboRow}>
        <TextInput
          style={[styles.input, styles.comboInput]}
          placeholder={t('chefExternalOrder', 'companyLabel')}
          value={form.unloadingCompany}
          onChangeText={set('unloadingCompany')}
        />
        <FluidPressable
          style={styles.comboChevronButton}
          onPress={() => openPicker('unloadingCompany')}
        >
          <Text style={styles.selectChevron}>▾</Text>
        </FluidPressable>
      </View>
      <TextInput
        style={styles.input}
        placeholder={t('chefExternalOrder', 'addressLabel')}
        value={form.unloadingAddress}
        onChangeText={set('unloadingAddress')}
      />

      <Text style={styles.sectionTitle}>{t('chefExternalOrder', 'conditionsSection')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('chefExternalOrder', 'freightRateLabel')}
        value={form.freightRate}
        onChangeText={set('freightRate')}
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        placeholder={t('chefExternalOrder', 'deadlineSurchargeLabel')}
        value={form.deadlineSurcharge}
        onChangeText={set('deadlineSurcharge')}
        keyboardType="numeric"
      />

      <FluidPressable style={styles.selectField} onPress={() => openPicker('paymentTerms')}>
        <Text style={form.paymentTerms ? styles.selectValue : styles.selectPlaceholder}>
          {form.paymentTerms || t('chefExternalOrder', 'paymentTermsLabel')}
        </Text>
        <Text style={styles.selectChevron}>▾</Text>
      </FluidPressable>

      <FluidPressable style={styles.selectField} onPress={() => openPicker('vehicleType')}>
        <Text style={form.vehicleType ? styles.selectValue : styles.selectPlaceholder}>
          {form.vehicleType || t('chefExternalOrder', 'vehicleTypeLabel')}
        </Text>
        <Text style={styles.selectChevron}>▾</Text>
      </FluidPressable>

      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder={t('chefExternalOrder', 'notesLabel')}
        value={form.notes}
        onChangeText={set('notes')}
        multiline
      />

      <Text style={styles.sectionTitle}>{t('chefExternalOrder', 'optionalSection')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('chefExternalOrder', 'licensePlateLabel')}
        value={form.licensePlate}
        onChangeText={set('licensePlate')}
      />
      <TextInput
        style={styles.input}
        placeholder={t('chefExternalOrder', 'driverNameLabel')}
        value={form.driverName}
        onChangeText={set('driverName')}
      />

      <FluidPressable
        style={[styles.createButton, isSaving && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.createButtonText}>{submitLabel}</Text>
        )}
      </FluidPressable>

      <Modal
        visible={activePicker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActivePicker(null)}
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
              <Text style={styles.modalTitle}>{pickerTitle}</Text>
              <FluidPressable onPress={() => setActivePicker(null)}>
                <Text style={styles.closeButton}>✕</Text>
              </FluidPressable>
            </View>
            {isSearchablePicker && (
              <TextInput
                style={styles.input}
                placeholder={t('chefExternalOrder', 'companySearchPlaceholder')}
                value={companySearch}
                onChangeText={setCompanySearch}
                autoFocus
              />
            )}
            {!isClosedListPicker && pickerOptions.length === 0 ? (
              <Text style={styles.emptyPickerText}>
                {t('chefExternalOrder', 'noCompaniesYet')}
              </Text>
            ) : visibleOptions.length === 0 ? (
              <Text style={styles.emptyPickerText}>
                {t('chefExternalOrder', 'noCompanyMatches')}
              </Text>
            ) : (
              <FlatList
                data={visibleOptions}
                keyExtractor={(item) => `${item.name}|${item.address}`}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <FluidPressable style={styles.vehicleOption} onPress={() => pickOption(item)}>
                    <Text style={styles.vehicleOptionText}>{item.name}</Text>
                    {!!item.address && (
                      <Text style={styles.vehicleOptionAddress}>{item.address}</Text>
                    )}
                  </FluidPressable>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontSize: 13,
    color: Colors.ui.darkGray,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.ui.charcoal,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontSize: 14,
    color: Colors.ui.charcoal,
    backgroundColor: 'white',
  },
  multiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timeInput: {
    flex: 1,
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
  emptyPickerText: {
    fontSize: 13,
    color: Colors.ui.darkGray,
    textAlign: 'center',
    paddingVertical: 24,
  },
  selectField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: 'white',
  },
  selectValue: {
    fontSize: 14,
    color: Colors.ui.charcoal,
  },
  selectPlaceholder: {
    fontSize: 14,
    color: '#9a9a9a',
  },
  selectChevron: {
    fontSize: 14,
    color: Colors.ui.darkGray,
  },
  createButton: {
    backgroundColor: Colors.ui.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
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
  vehicleOption: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: Colors.ui.lightGray,
  },
  vehicleOptionAddress: {
    fontSize: 12,
    color: Colors.ui.darkGray,
    marginTop: 2,
  },
  vehicleOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.charcoal,
  },
});
