import {
  downloadInvoiceXlsx,
  loadInvoice,
  saveInvoice,
  type Invoice,
} from '@/app/services/invoiceService';
import { DateField } from '@/components/DateField';
import { BlurSurface } from '@/components/fluid/BlurSurface';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Colors } from '@/constants/theme';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert } from '@/lib/alert';
import { PAYMENT_TERMS_OPTIONS } from '@/lib/transportauftragPdf';
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

interface InvoiceFormProps {
  orderId: string;
  orderNr: string;
}

/**
 * Die Rechnung zum erledigten Auftrag — bearbeiten und als Excel-Datei
 * herunterladen. Aufbau und Bedienung folgen OwnOrderForm/ExternalOrderForm:
 * Abschnittsüberschriften, dieselben Eingabefelder, unten der Button.
 *
 * Beim ersten Öffnen legt die Edge Function die Rechnung an und füllt sie
 * aus dem Auftrag vor (siehe app/services/invoiceService.ts). Ab dann zählt
 * nur noch, was hier steht: der Auftrag wird durch eine Änderung an der
 * Rechnung nie verändert, und ein erneuter Download liefert dieselbe
 * Belegnummer.
 */
export function InvoiceForm({ orderId, orderNr }: InvoiceFormProps) {
  const { t } = useTranslation();

  const [form, setForm] = useState<Invoice | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  useEffect(() => {
    let active = true;

    loadInvoice(orderId)
      .then((invoice) => {
        if (active) setForm(invoice);
      })
      // Nur die Meldung merken, nicht übersetzen: t() hier hineinzuziehen
      // machte die Übersetzungsfunktion zur Abhängigkeit des Effects — und
      // damit das Laden von jedem Render abhängig. Der Ersatztext kommt
      // beim Rendern dazu.
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : '');
      });

    // Verhindert ein setState auf einer Ansicht, die der Chef schon wieder
    // verlassen hat, während die Function noch antwortet.
    return () => {
      active = false;
    };
  }, [orderId]);

  const set = (field: keyof Invoice) => (value: string) =>
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));

  const handleSave = async () => {
    if (!form) return;
    setIsSaving(true);
    try {
      await saveInvoice(orderId, form);
      showAlert(t('common', 'success'), t('chefInvoice', 'saved'));
    } catch (error) {
      showAlert(
        t('common', 'error'),
        error instanceof Error ? error.message : t('chefInvoice', 'saveFailed')
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Erst speichern, dann exportieren: sonst lädt der Chef eine Datei
  // herunter, in der seine gerade getippten Änderungen fehlen — die Excel
  // Datei baut die Function aus der Datenbank, nicht aus dem Formular.
  const handleExport = async () => {
    if (!form) return;
    setIsExporting(true);
    try {
      await saveInvoice(orderId, form);
      await downloadInvoiceXlsx(orderId, orderNr);
    } catch (error) {
      showAlert(
        t('common', 'error'),
        error instanceof Error ? error.message : t('chefInvoice', 'exportFailed')
      );
    } finally {
      setIsExporting(false);
    }
  };

  if (loadError !== null) {
    return (
      <Text style={styles.errorText}>{loadError || t('chefInvoice', 'loadFailed')}</Text>
    );
  }

  if (!form) {
    return <ActivityIndicator style={styles.loading} color={Colors.ui.primary} />;
  }

  const busy = isSaving || isExporting;

  return (
    <>
      <Text style={styles.sectionTitle}>{t('chefInvoice', 'headSection')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('chefInvoice', 'belegnummerLabel')}
        value={form.belegnummer}
        onChangeText={set('belegnummer')}
      />
      <DateField
        value={form.rechnungsdatum}
        onChange={set('rechnungsdatum')}
        placeholder={t('chefInvoice', 'rechnungsdatumLabel')}
      />

      <Text style={styles.sectionTitle}>{t('chefInvoice', 'recipientSection')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('chefInvoice', 'empfaengerNameLabel')}
        value={form.empfaengerName}
        onChangeText={set('empfaengerName')}
      />
      <TextInput
        style={styles.input}
        placeholder={t('chefInvoice', 'empfaengerStrasseLabel')}
        value={form.empfaengerStrasse}
        onChangeText={set('empfaengerStrasse')}
      />
      <TextInput
        style={styles.input}
        placeholder={t('chefInvoice', 'empfaengerOrtLabel')}
        value={form.empfaengerOrt}
        onChangeText={set('empfaengerOrt')}
      />
      <TextInput
        style={styles.input}
        placeholder={t('chefInvoice', 'kundennummerLabel')}
        value={form.kundennummer}
        onChangeText={set('kundennummer')}
      />
      <TextInput
        style={styles.input}
        placeholder={t('chefInvoice', 'uidNummerLabel')}
        value={form.uidNummer}
        onChangeText={set('uidNummer')}
      />

      <Text style={styles.sectionTitle}>{t('chefInvoice', 'positionSection')}</Text>
      <DateField
        value={form.positionDatum}
        onChange={set('positionDatum')}
        placeholder={t('chefInvoice', 'positionDatumLabel')}
      />
      <TextInput
        style={styles.input}
        placeholder={t('chefInvoice', 'bezeichnungLabel')}
        value={form.bezeichnung}
        onChangeText={set('bezeichnung')}
      />
      <TextInput
        style={styles.input}
        placeholder={t('chefInvoice', 'transportnrLabel')}
        value={form.transportnr}
        onChangeText={set('transportnr')}
      />
      <TextInput
        style={styles.input}
        placeholder={t('chefInvoice', 'ladestelleLabel')}
        value={form.ladestelle}
        onChangeText={set('ladestelle')}
      />
      <DateField
        value={form.ladedatum}
        onChange={set('ladedatum')}
        placeholder={t('chefInvoice', 'ladedatumLabel')}
      />
      <TextInput
        style={styles.input}
        placeholder={t('chefInvoice', 'entladestelleLabel')}
        value={form.entladestelle}
        onChangeText={set('entladestelle')}
      />
      <DateField
        value={form.entladedatum}
        onChange={set('entladedatum')}
        placeholder={t('chefInvoice', 'entladedatumLabel')}
      />

      <Text style={styles.sectionTitle}>{t('chefInvoice', 'amountSection')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('chefInvoice', 'preisLabel')}
        value={form.preis}
        onChangeText={set('preis')}
        keyboardType="decimal-pad"
      />
      <TextInput
        style={styles.input}
        placeholder={t('chefInvoice', 'ustSatzLabel')}
        value={form.ustSatz}
        onChangeText={set('ustSatz')}
        keyboardType="decimal-pad"
      />
      {/* Dieselbe Konditionsliste wie im Transportauftrag (siehe
          ExternalOrderForm): So heißt dieselbe Kondition auf dem Auftrag
          und auf der Rechnung auch gleich. */}
      <FluidPressable style={styles.selectField} onPress={() => setIsPickerOpen(true)}>
        <Text style={form.zahlungsziel ? styles.selectValue : styles.selectPlaceholder}>
          {form.zahlungsziel || t('chefInvoice', 'zahlungszielLabel')}
        </Text>
        <Text style={styles.selectChevron}>▾</Text>
      </FluidPressable>

      <View style={styles.buttonRow}>
        <FluidPressable
          style={[styles.saveButton, busy && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={busy}
        >
          {isSaving ? (
            <ActivityIndicator color={Colors.ui.primary} />
          ) : (
            <Text style={styles.saveButtonText}>{t('chefInvoice', 'saveButton')}</Text>
          )}
        </FluidPressable>

        <FluidPressable
          style={[styles.exportButton, busy && styles.buttonDisabled]}
          onPress={handleExport}
          disabled={busy}
        >
          {isExporting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.exportButtonText}>{t('chefInvoice', 'exportButton')}</Text>
          )}
        </FluidPressable>
      </View>

      <Text style={styles.hint}>{t('chefInvoice', 'hint')}</Text>

      <Modal
        visible={isPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPickerOpen(false)}
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
              <Text style={styles.modalTitle}>{t('chefInvoice', 'zahlungszielLabel')}</Text>
              <FluidPressable onPress={() => setIsPickerOpen(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </FluidPressable>
            </View>
            <FlatList
              data={PAYMENT_TERMS_OPTIONS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <FluidPressable
                  style={styles.pickerOption}
                  onPress={() => {
                    set('zahlungsziel')(item);
                    setIsPickerOpen(false);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{item}</Text>
                </FluidPressable>
              )}
            />
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
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  saveButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.ui.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'white',
  },
  saveButtonText: {
    color: Colors.ui.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  exportButton: {
    flex: 1,
    backgroundColor: Colors.ui.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  exportButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  hint: {
    fontSize: 12,
    color: Colors.ui.darkGray,
    lineHeight: 17,
    marginTop: 10,
  },
  loading: {
    marginVertical: 24,
  },
  errorText: {
    fontSize: 13,
    color: Colors.ui.darkGray,
    lineHeight: 18,
  },
});
