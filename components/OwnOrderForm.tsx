import type { OrderFields } from '@/app/services/orderService';
import { addSiteCompanyIfNew, getSiteCompanies, type SiteCompany } from '@/app/services/siteCompanyService';
import { addUnloadingCompanyIfNew, getUnloadingCompanies } from '@/app/services/unloadingCompanyService';
import { DateField } from '@/components/DateField';
import { TimeField } from '@/components/TimeField';
import { BlurSurface } from '@/components/fluid/BlurSurface';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Colors } from '@/constants/theme';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert } from '@/lib/alert';
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

type PickerField = 'loadingCompany' | 'unloadingCompany';

const emptyFields: OrderFields = {
  createdBy: '',
  orderNr: '',
  loadingDate: '',
  loadingTimeFrom: '',
  loadingTimeUntil: '',
  loadingCompany: '',
  loadingAddress: '',
  loadingMeters: '',
  unloadingDate: '',
  unloadingTimeFrom: '',
  unloadingTimeUntil: '',
  unloadingCompany: '',
  unloadingAddress: '',
};

interface OwnOrderFormProps {
  initialValues?: Partial<OrderFields>;
  submitLabel: string;
  onSubmit: (fields: OrderFields) => Promise<void>;
}

// Shared by app/chef/order/new.tsx (create) and [id].tsx (edit) — same
// field layout as ExternalOrderForm (down to reusing the site-company
// directory for Ladestelle/Entladestelle), minus everything that only
// makes sense once a job leaves the company (recipient, freight terms,
// vehicle, legal notes).
export function OwnOrderForm({ initialValues, submitLabel, onSubmit }: OwnOrderFormProps) {
  const { t } = useTranslation();

  const [form, setForm] = useState<OrderFields>({ ...emptyFields, ...initialValues });
  const [siteCompanies, setSiteCompanies] = useState<SiteCompany[]>([]);
  const [unloadingCompanies, setUnloadingCompanies] = useState<string[]>([]);
  const [activePicker, setActivePicker] = useState<PickerField | null>(null);
  const [companySearch, setCompanySearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getSiteCompanies().then(setSiteCompanies);
    getUnloadingCompanies().then(setUnloadingCompanies);
  }, []);

  const set = (field: keyof OrderFields) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Ladung und Entladung ziehen aus zwei getrennten Listen: an der
  // Ladestelle die importierten Kundenfirmen samt Adresse, an der
  // Entladestelle die selbst gewachsene Liste ohne Adresse.
  const isLoadingPicker = activePicker === 'loadingCompany';
  const pickerCompanies = isLoadingPicker
    ? siteCompanies.map((company) => company.name)
    : unloadingCompanies;

  // Gesucht wird nur in der langen Ladestellen-Liste, und zwar überall im
  // Namen — ein eingetippter Teil genügt, der Anfang muss es nicht sein.
  const query = companySearch.trim().toLowerCase();
  const visibleCompanies =
    isLoadingPicker && query
      ? pickerCompanies.filter((name) => name.toLowerCase().includes(query))
      : pickerCompanies;

  const openPicker = (field: PickerField) => {
    setCompanySearch('');
    setActivePicker(field);
  };

  // Mit einer Ladestellen-Firma kommt gleich ihre Adresse ins Formular —
  // sie ist pro Firma immer dieselbe und steht in site_companies. Ist dort
  // keine hinterlegt, bleibt stehen, was schon im Adressfeld steht, statt
  // es zu leeren. Die Entladeadresse wird immer von Hand eingetragen.
  const pickCompany = (name: string) => {
    const field = activePicker as PickerField;
    setForm((prev) => {
      const next = { ...prev, [field]: name };
      const address = siteCompanies.find((company) => company.name === name)?.address;
      if (address && field === 'loadingCompany') next.loadingAddress = address;
      return next;
    });
    setActivePicker(null);
  };

  const handleSubmit = async () => {
    const { loadingDate, loadingCompany, loadingAddress, unloadingDate, unloadingCompany, unloadingAddress } = form;

    if (
      !loadingDate.trim() || !loadingCompany.trim() || !loadingAddress.trim() ||
      !unloadingDate.trim() || !unloadingCompany.trim() || !unloadingAddress.trim()
    ) {
      showAlert(t('common', 'error'), t('chefOwnOrder', 'alertFillFields'));
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit(form);

      // Best-effort, after the fact: remembers freshly typed site companies
      // for next time's dropdowns. Never blocks saving if it fails (see
      // service) — fire-and-forget so it can't delay navigating back.
      addSiteCompanyIfNew(form.loadingCompany);
      addUnloadingCompanyIfNew(form.unloadingCompany);
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      showAlert(t('common', 'error'), message || t('chefOwnOrder', 'alertPdfFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Text style={styles.sectionTitle}>{t('chefOwnOrder', 'orderNrLabel')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('chefOwnOrder', 'orderNrPlaceholder')}
        value={form.orderNr}
        onChangeText={set('orderNr')}
        keyboardType="numeric"
      />

      <Text style={styles.sectionTitle}>{t('chefOwnOrder', 'loadingSection')}</Text>
      <DateField
        value={form.loadingDate}
        onChange={set('loadingDate')}
        placeholder={t('chefOwnOrder', 'dateLabel')}
      />
      <View style={styles.timeRow}>
        <View style={styles.timeInput}>
          <TimeField
            value={form.loadingTimeFrom}
            onChange={set('loadingTimeFrom')}
            placeholder={t('chefOwnOrder', 'timeFromLabel')}
          />
        </View>
        <View style={styles.timeInput}>
          <TimeField
            value={form.loadingTimeUntil}
            onChange={set('loadingTimeUntil')}
            placeholder={t('chefOwnOrder', 'timeUntilLabel')}
          />
        </View>
      </View>
      <View style={styles.comboRow}>
        <TextInput
          style={[styles.input, styles.comboInput]}
          placeholder={t('chefOwnOrder', 'companyLabel')}
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
        placeholder={t('chefOwnOrder', 'addressLabel')}
        value={form.loadingAddress}
        onChangeText={set('loadingAddress')}
      />
      <TextInput
        style={styles.input}
        placeholder={t('chefOwnOrder', 'loadingMetersLabel')}
        value={form.loadingMeters}
        onChangeText={set('loadingMeters')}
      />

      <Text style={styles.sectionTitle}>{t('chefOwnOrder', 'unloadingSection')}</Text>
      <DateField
        value={form.unloadingDate}
        onChange={set('unloadingDate')}
        placeholder={t('chefOwnOrder', 'dateLabel')}
      />
      <View style={styles.timeRow}>
        <View style={styles.timeInput}>
          <TimeField
            value={form.unloadingTimeFrom}
            onChange={set('unloadingTimeFrom')}
            placeholder={t('chefOwnOrder', 'timeFromLabel')}
          />
        </View>
        <View style={styles.timeInput}>
          <TimeField
            value={form.unloadingTimeUntil}
            onChange={set('unloadingTimeUntil')}
            placeholder={t('chefOwnOrder', 'timeUntilLabel')}
          />
        </View>
      </View>
      <View style={styles.comboRow}>
        <TextInput
          style={[styles.input, styles.comboInput]}
          placeholder={t('chefOwnOrder', 'companyLabel')}
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
        placeholder={t('chefOwnOrder', 'addressLabel')}
        value={form.unloadingAddress}
        onChangeText={set('unloadingAddress')}
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
              <Text style={styles.modalTitle}>{t('chefOwnOrder', 'companyLabel')}</Text>
              <FluidPressable onPress={() => setActivePicker(null)}>
                <Text style={styles.closeButton}>✕</Text>
              </FluidPressable>
            </View>
            {isLoadingPicker && (
              <TextInput
                style={styles.input}
                placeholder={t('chefOwnOrder', 'companySearchPlaceholder')}
                value={companySearch}
                onChangeText={setCompanySearch}
                autoFocus
              />
            )}
            {pickerCompanies.length === 0 ? (
              <Text style={styles.emptyPickerText}>
                {t('chefOwnOrder', 'noCompaniesYet')}
              </Text>
            ) : visibleCompanies.length === 0 ? (
              <Text style={styles.emptyPickerText}>
                {t('chefOwnOrder', 'noCompanyMatches')}
              </Text>
            ) : (
              <FlatList
                data={visibleCompanies}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <FluidPressable style={styles.vehicleOption} onPress={() => pickCompany(item)}>
                    <Text style={styles.vehicleOptionText}>{item}</Text>
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
  vehicleOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.charcoal,
  },
});
