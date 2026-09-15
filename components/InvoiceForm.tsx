import {
  addInvoiceItems,
  createInvoice,
  downloadInvoiceXlsx,
  getBillableOrders,
  loadInvoiceForOrder,
  removeInvoiceItem,
  saveInvoice,
  type BillableOrder,
  type Invoice,
  type InvoiceHeader,
  type InvoiceItem,
} from '@/app/services/invoiceService';
import { DateField } from '@/components/DateField';
import { BlurSurface } from '@/components/fluid/BlurSurface';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert, showConfirm } from '@/lib/alert';
import { isoToGerman } from '@/lib/dateFormat';
import { PAYMENT_TERMS_OPTIONS } from '@/lib/transportauftragPdf';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

interface InvoiceFormProps {
  orderId: string;
  orderNr: string;
  /** Zum Vorsortieren der Auswahl: Aufträge desselben Kunden stehen oben. */
  loadingCompany: string;
}

/** Was gerade läuft — immer nur eine Aktion, alle Buttons sind so lange gesperrt. */
type BusyAction = 'saving' | 'exporting' | 'creating' | 'adding' | 'removing';

/** Wofür die Auftragsauswahl gerade offen ist. */
type PickerMode = 'create' | 'add';

function sameCompany(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Die Rechnung zum erledigten Auftrag — als Einzelrechnung oder als
 * Sammelrechnung über mehrere Ladungen, bearbeiten und als Excel-Datei
 * herunterladen. Aufbau und Bedienung folgen OwnOrderForm/ExternalOrderForm:
 * Abschnittsüberschriften, dieselben Eingabefelder, unten der Button.
 *
 * Steht der Auftrag noch auf keiner Rechnung, wählt der Chef zuerst die Art.
 * Erst dann legt die Edge Function die Rechnung an, vergibt die Belegnummer
 * und füllt alles aus den Aufträgen vor (siehe
 * app/services/invoiceService.ts). Ab dann zählt nur noch, was hier steht:
 * der Auftrag wird durch eine Änderung an der Rechnung nie verändert, und
 * ein erneuter Download liefert dieselbe Belegnummer.
 */
export function InvoiceForm({ orderId, orderNr, loadingCompany }: InvoiceFormProps) {
  const styles = useThemedStyles(createStyles);
  const { c, scheme } = useAppTheme();
  const { t } = useTranslation();

  // undefined: lädt noch, null: noch keine Rechnung.
  const [form, setForm] = useState<Invoice | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction | null>(null);
  const [isTermsPickerOpen, setIsTermsPickerOpen] = useState(false);

  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
  const [billable, setBillable] = useState<BillableOrder[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;

    loadInvoiceForOrder(orderId)
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

  const setHeader = (field: keyof InvoiceHeader) => (value: string) =>
    setForm((prev) => (prev ? { ...prev, header: { ...prev.header, [field]: value } } : prev));

  const setItem = (index: number, field: keyof InvoiceItem) => (value: string) =>
    setForm((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
          }
        : prev
    );

  /** Führt eine Aktion aus und zeigt ihren Fehler — so sieht jeder Button gleich aus. */
  const run = async (action: BusyAction, fallbackMessage: string, task: () => Promise<void>) => {
    setBusy(action);
    try {
      await task();
    } catch (error) {
      showAlert(t('common', 'error'), error instanceof Error ? error.message : fallbackMessage);
    } finally {
      setBusy(null);
    }
  };

  const handleSave = () =>
    run('saving', t('chefInvoice', 'saveFailed'), async () => {
      if (!form) return;
      await saveInvoice(form);
      showAlert(t('common', 'success'), t('chefInvoice', 'saved'));
    });

  // Erst speichern, dann exportieren: sonst lädt der Chef eine Datei
  // herunter, in der seine gerade getippten Änderungen fehlen — die Excel
  // Datei baut die Function aus der Datenbank, nicht aus dem Formular.
  const handleExport = () =>
    run('exporting', t('chefInvoice', 'exportFailed'), async () => {
      if (!form) return;
      await saveInvoice(form);
      await downloadInvoiceXlsx(form);
    });

  const handleCreateSingle = () =>
    run('creating', t('chefInvoice', 'createFailed'), async () => {
      setForm(await createInvoice([orderId]));
    });

  const openPicker = async (mode: PickerMode) => {
    setPickerMode(mode);
    setSelected(new Set());
    setBillable(null);
    try {
      setBillable(await getBillableOrders());
    } catch (error) {
      setPickerMode(null);
      showAlert(
        t('common', 'error'),
        error instanceof Error ? error.message : t('chefInvoice', 'billableLoadFailed')
      );
    }
  };

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handlePickerConfirm = () => {
    const mode = pickerMode;
    const ids = [...selected];
    setPickerMode(null);

    if (mode === 'create') {
      run('creating', t('chefInvoice', 'createFailed'), async () => {
        setForm(await createInvoice([orderId, ...ids]));
      });
    } else if (mode === 'add') {
      // Vorher speichern: die Function liefert die Rechnung frisch aus der
      // Datenbank zurück, ungespeicherte Eingaben wären sonst weg.
      run('adding', t('chefInvoice', 'saveFailed'), async () => {
        if (!form) return;
        await saveInvoice(form);
        setForm(await addInvoiceItems(form.header.id, ids));
      });
    }
  };

  const handleRemoveItem = (item: InvoiceItem) => {
    if (!form) return;
    const current = form;

    showConfirm(
      t('chefInvoice', 'removeItemConfirmTitle'),
      t('chefInvoice', 'removeItemConfirmMessage').replace('{orderNr}', item.orderNr),
      () =>
        run('removing', t('chefInvoice', 'saveFailed'), async () => {
          await saveInvoice(current);
          const updated = await removeInvoiceItem(current.header.id, item.id);
          // Wurde die Ladung dieses Auftrags entfernt, gehört die Rechnung
          // nicht mehr zu dieser Ansicht — dann wieder die Auswahl zeigen.
          setForm(updated.items.some((i) => i.orderId === orderId) ? updated : null);
        }),
      { destructive: true, confirmText: t('chefInvoice', 'removeItem') }
    );
  };

  if (loadError !== null) {
    return (
      <Text style={styles.errorText}>{loadError || t('chefInvoice', 'loadFailed')}</Text>
    );
  }

  if (form === undefined) {
    return <ActivityIndicator style={styles.loading} color={c.tint} />;
  }

  // Aufträge in der Auswahl: der aktuelle ist bei "create" fest dabei und
  // wird nicht angeboten; derselbe Kunde steht oben, weil eine
  // Sammelrechnung in aller Regel an genau eine Firma geht.
  const candidates = (billable ?? []).filter(
    (order) => order.id !== orderId && !form?.items.some((item) => item.orderId === order.id)
  );
  const sameCustomer = candidates.filter((order) =>
    sameCompany(order.loadingCompany, loadingCompany)
  );
  const otherCustomers = candidates.filter(
    (order) => !sameCompany(order.loadingCompany, loadingCompany)
  );

  const renderCandidate = (order: BillableOrder) => {
    const isSelected = selected.has(order.id);
    return (
      <FluidPressable
        key={order.id}
        style={[styles.candidate, isSelected && styles.candidateSelected]}
        onPress={() => toggleSelected(order.id)}
      >
        <Text style={styles.checkbox}>{isSelected ? '☑' : '☐'}</Text>
        <View style={styles.candidateText}>
          <Text style={styles.candidateTitle}>
            Nr. {order.orderNr}
            {order.date ? ` · ${isoToGerman(order.date)}` : ''}
          </Text>
          <Text style={styles.candidateSubtitle}>
            {order.loadingCompany || '—'} → {order.unloadingCompany || '—'}
          </Text>
        </View>
      </FluidPressable>
    );
  };

  const orderPicker = (
    <Modal
      visible={pickerMode !== null}
      transparent
      animationType="slide"
      onRequestClose={() => setPickerMode(null)}
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
            <Text style={styles.modalTitle}>
              {t('chefInvoice', pickerMode === 'add' ? 'pickerAddTitle' : 'pickerCreateTitle')}
            </Text>
            <FluidPressable onPress={() => setPickerMode(null)}>
              <Text style={styles.closeButton}>✕</Text>
            </FluidPressable>
          </View>
          <Text style={styles.hint}>{t('chefInvoice', 'pickerHint')}</Text>

          {billable === null ? (
            <ActivityIndicator style={styles.loading} color={c.tint} />
          ) : (
            <ScrollView style={styles.pickerList}>
              {pickerMode === 'create' ? (
                <View style={[styles.candidate, styles.candidateFixed]}>
                  <Text style={styles.checkbox}>☑</Text>
                  <Text style={styles.candidateTitle}>
                    {t('chefInvoice', 'pickerCurrentOrder').replace('{orderNr}', orderNr)}
                  </Text>
                </View>
              ) : null}

              {candidates.length === 0 ? (
                <Text style={styles.hint}>{t('chefInvoice', 'pickerEmpty')}</Text>
              ) : null}

              {sameCustomer.length > 0 ? (
                <>
                  <Text style={styles.groupTitle}>{t('chefInvoice', 'pickerSameCustomer')}</Text>
                  {sameCustomer.map(renderCandidate)}
                </>
              ) : null}

              {otherCustomers.length > 0 ? (
                <>
                  <Text style={styles.groupTitle}>{t('chefInvoice', 'pickerOtherCustomers')}</Text>
                  {otherCustomers.map(renderCandidate)}
                </>
              ) : null}
            </ScrollView>
          )}

          <FluidPressable
            style={[styles.exportButton, styles.pickerConfirm, selected.size === 0 && styles.buttonDisabled]}
            onPress={handlePickerConfirm}
            disabled={selected.size === 0}
          >
            <Text style={styles.exportButtonText}>
              {pickerMode === 'add'
                ? t('chefInvoice', 'pickerConfirmAdd').replace('{count}', String(selected.size))
                : t('chefInvoice', 'pickerConfirmCreate').replace(
                    '{count}',
                    String(selected.size + 1)
                  )}
            </Text>
          </FluidPressable>
        </View>
      </View>
    </Modal>
  );

  // --- Noch keine Rechnung: Einzel- oder Sammelrechnung? --------------------
  if (form === null) {
    return (
      <>
        <Text style={styles.hint}>{t('chefInvoice', 'choiceHint')}</Text>
        <View style={styles.buttonRow}>
          <FluidPressable
            style={[styles.saveButton, busy !== null && styles.buttonDisabled]}
            onPress={() => openPicker('create')}
            disabled={busy !== null}
          >
            <Text style={styles.saveButtonText}>{t('chefInvoice', 'collectiveButton')}</Text>
          </FluidPressable>
          <FluidPressable
            style={[styles.exportButton, busy !== null && styles.buttonDisabled]}
            onPress={handleCreateSingle}
            disabled={busy !== null}
          >
            {busy === 'creating' ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.exportButtonText}>{t('chefInvoice', 'singleButton')}</Text>
            )}
          </FluidPressable>
        </View>
        {orderPicker}
      </>
    );
  }

  const { header, items } = form;
  const isBusy = busy !== null;

  return (
    <>
      <View style={styles.typeBadge}>
        <Text style={styles.typeBadgeText}>
          {items.length > 1
            ? t('chefInvoice', 'typeCollective').replace('{count}', String(items.length))
            : t('chefInvoice', 'typeSingle')}
        </Text>
      </View>

      {/* Laptop/Desktop: zwei Spalten nebeneinander */}
      <View style={styles.pair}>
        <View style={styles.pairItem}>
          <Text style={styles.sectionTitle}>{t('chefInvoice', 'headSection')}</Text>
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            placeholder={t('chefInvoice', 'belegnummerLabel')}
            value={header.belegnummer}
            onChangeText={setHeader('belegnummer')}
          />
          <DateField
            value={header.rechnungsdatum}
            onChange={setHeader('rechnungsdatum')}
            placeholder={t('chefInvoice', 'rechnungsdatumLabel')}
          />

        </View>
        <View style={styles.pairItem}>
          <Text style={styles.sectionTitle}>{t('chefInvoice', 'recipientSection')}</Text>
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            placeholder={t('chefInvoice', 'empfaengerNameLabel')}
            value={header.empfaengerName}
            onChangeText={setHeader('empfaengerName')}
          />
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            placeholder={t('chefInvoice', 'empfaengerStrasseLabel')}
            value={header.empfaengerStrasse}
            onChangeText={setHeader('empfaengerStrasse')}
          />
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            placeholder={t('chefInvoice', 'empfaengerOrtLabel')}
            value={header.empfaengerOrt}
            onChangeText={setHeader('empfaengerOrt')}
          />
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            placeholder={t('chefInvoice', 'kundennummerLabel')}
            value={header.kundennummer}
            onChangeText={setHeader('kundennummer')}
          />
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            placeholder={t('chefInvoice', 'uidNummerLabel')}
            value={header.uidNummer}
            onChangeText={setHeader('uidNummer')}
          />

        </View>
      </View>
      
      <Text style={styles.sectionTitle}>{t('chefInvoice', 'positionSection')}</Text>
      {items.map((item, index) => (
        <View key={item.id} style={styles.itemBlock}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>
              {t('chefInvoice', 'itemTitle')
                .replace('{index}', String(index + 1))
                .replace('{orderNr}', item.orderNr)}
            </Text>
            {/* Die letzte Ladung bleibt: eine Rechnung ohne Position hätte
                trotzdem eine Belegnummer verbraucht. */}
            {items.length > 1 ? (
              <FluidPressable onPress={() => handleRemoveItem(item)} disabled={isBusy}>
                <Text style={styles.removeLink}>{t('chefInvoice', 'removeItem')}</Text>
              </FluidPressable>
            ) : null}
          </View>

          <DateField
            value={item.positionDatum}
            onChange={setItem(index, 'positionDatum')}
            placeholder={t('chefInvoice', 'positionDatumLabel')}
          />
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            placeholder={t('chefInvoice', 'bezeichnungLabel')}
            value={item.bezeichnung}
            onChangeText={setItem(index, 'bezeichnung')}
          />
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            placeholder={t('chefInvoice', 'transportnrLabel')}
            value={item.transportnr}
            onChangeText={setItem(index, 'transportnr')}
          />
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            placeholder={t('chefInvoice', 'ladestelleLabel')}
            value={item.ladestelle}
            onChangeText={setItem(index, 'ladestelle')}
          />
          <DateField
            value={item.ladedatum}
            onChange={setItem(index, 'ladedatum')}
            placeholder={t('chefInvoice', 'ladedatumLabel')}
          />
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            placeholder={t('chefInvoice', 'entladestelleLabel')}
            value={item.entladestelle}
            onChangeText={setItem(index, 'entladestelle')}
          />
          <DateField
            value={item.entladedatum}
            onChange={setItem(index, 'entladedatum')}
            placeholder={t('chefInvoice', 'entladedatumLabel')}
          />
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            placeholder={t('chefInvoice', 'preisLabel')}
            value={item.preis}
            onChangeText={setItem(index, 'preis')}
            keyboardType="decimal-pad"
          />
        </View>
      ))}

      <FluidPressable
        style={[styles.addButton, isBusy && styles.buttonDisabled]}
        onPress={() => openPicker('add')}
        disabled={isBusy}
      >
        {busy === 'adding' || busy === 'removing' ? (
          <ActivityIndicator color={c.tint} />
        ) : (
          <Text style={styles.addButtonText}>{t('chefInvoice', 'addItemsButton')}</Text>
        )}
      </FluidPressable>

      <Text style={styles.sectionTitle}>{t('chefInvoice', 'amountSection')}</Text>
      <TextInput
        placeholderTextColor={c.placeholder}
        keyboardAppearance={scheme}
        style={styles.input}
        placeholder={t('chefInvoice', 'ustSatzLabel')}
        value={header.ustSatz}
        onChangeText={setHeader('ustSatz')}
        keyboardType="decimal-pad"
      />
      {/* Dieselbe Konditionsliste wie im Transportauftrag (siehe
          ExternalOrderForm): So heißt dieselbe Kondition auf dem Auftrag
          und auf der Rechnung auch gleich. */}
      <FluidPressable style={styles.selectField} onPress={() => setIsTermsPickerOpen(true)}>
        <Text style={header.zahlungsziel ? styles.selectValue : styles.selectPlaceholder}>
          {header.zahlungsziel || t('chefInvoice', 'zahlungszielLabel')}
        </Text>
        <Text style={styles.selectChevron}>▾</Text>
      </FluidPressable>

      <View style={styles.buttonRow}>
        <FluidPressable
          style={[styles.saveButton, isBusy && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={isBusy}
        >
          {busy === 'saving' ? (
            <ActivityIndicator color={c.tint} />
          ) : (
            <Text style={styles.saveButtonText}>{t('chefInvoice', 'saveButton')}</Text>
          )}
        </FluidPressable>

        <FluidPressable
          style={[styles.exportButton, isBusy && styles.buttonDisabled]}
          onPress={handleExport}
          disabled={isBusy}
        >
          {busy === 'exporting' ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.exportButtonText}>{t('chefInvoice', 'exportButton')}</Text>
          )}
        </FluidPressable>
      </View>

      <Text style={styles.hint}>{t('chefInvoice', 'hint')}</Text>

      {orderPicker}

      <Modal
        visible={isTermsPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsTermsPickerOpen(false)}
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
              <FluidPressable onPress={() => setIsTermsPickerOpen(false)}>
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
                    setHeader('zahlungsziel')(item);
                    setIsTermsPickerOpen(false);
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

const createStyles = (theme: AppTheme) => {
  const { c } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    pair: u.pair,
    pairItem: u.pairItem,
    sectionTitle: u.sectionTitle,
    typeBadge: {
      ...u.badge,
      backgroundColor: c.surfaceTertiary,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xxs,
    },
    typeBadgeText: {
      ...Typography.footnote,
      fontWeight: '600',
      color: c.text,
    },
    input: u.input,
    itemBlock: {
      borderRadius: Radius.lg,
      padding: Spacing.md,
      paddingBottom: Spacing.xs,
      marginBottom: Spacing.sm,
      backgroundColor: c.surfaceSecondary,
    },
    itemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    itemTitle: {
      ...Typography.headline,
      color: c.text,
      flexShrink: 1,
    },
    removeLink: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.danger,
      minHeight: Layout.minTouch,
      lineHeight: Layout.minTouch,
      paddingHorizontal: Spacing.xs,
    },
    addButton: {
      ...u.tintedButton,
      minHeight: 48,
      marginBottom: Spacing.xxs,
    },
    addButtonText: u.tintedButtonText,
    selectField: u.field,
    selectValue: u.fieldValue,
    selectPlaceholder: u.fieldPlaceholder,
    selectChevron: u.chevron,
    modalOverlay: u.modalOverlay,
    modalContent: u.modalSheet,
    modalHeader: u.modalHeader,
    modalTitle: u.modalTitle,
    closeButton: u.closeButton,
    pickerList: {
      marginTop: Spacing.sm,
      flexGrow: 0,
    },
    groupTitle: {
      ...u.sectionTitle,
      marginTop: Spacing.md,
    },
    candidate: {
      ...u.option,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    candidateSelected: {
      borderColor: c.tint,
      backgroundColor: c.tintSoft,
    },
    candidateFixed: {
      opacity: 0.6,
    },
    checkbox: {
      fontSize: 20,
      color: c.tint,
      marginRight: Spacing.sm,
    },
    candidateText: {
      flexShrink: 1,
    },
    candidateTitle: u.optionText,
    candidateSubtitle: u.optionSubtext,
    pickerConfirm: {
      flex: 0,
      marginTop: Spacing.md,
    },
    pickerOption: u.option,
    pickerOptionText: u.optionText,
    buttonRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
      marginTop: Spacing.lg,
    },
    saveButton: {
      ...u.secondaryButton,
      flexGrow: 1,
      flexBasis: 160,
      paddingHorizontal: Spacing.sm,
    },
    saveButtonText: u.secondaryButtonText,
    exportButton: {
      ...u.primaryButton,
      flexGrow: 1,
      flexBasis: 160,
      paddingHorizontal: Spacing.sm,
    },
    exportButtonText: u.primaryButtonText,
    buttonDisabled: u.disabled,
    hint: {
      ...u.hint,
      marginTop: Spacing.sm,
      paddingHorizontal: Spacing.xxs,
    },
    loading: {
      marginVertical: Spacing.lg,
    },
    errorText: {
      ...Typography.subhead,
      color: c.textSecondary,
    },
  });
};
