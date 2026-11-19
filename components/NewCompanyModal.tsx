import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type CompanyTable, createCompany, type NewCompany } from '@/app/services/companyMasterData';
import { BlurSurface } from '@/components/fluid/BlurSurface';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Spacing, Typography } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert } from '@/lib/alert';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const EMPTY: NewCompany = {
  name: '',
  strasse: '',
  land: 'A',
  plz: '',
  ort: '',
  uidNummer: '',
  bmdKtoNr: '',
};

/**
 * "Neue Firma anlegen" aus der Auswahlliste im Auftrag — Kunde (Auftraggeber,
 * Ladestelle) oder Subunternehmer. Pflicht ist nur der Name. UID und
 * BMD-Kontonummer gibt es nur beim Kunden, und auch dort freiwillig. Nach
 * dem Speichern steht die Firma in der Tabelle und ist im Auftrag gleich
 * ausgewählt (onCreated).
 */
export function NewCompanyModal({
  table,
  initialName,
  onClose,
  onCreated,
}: {
  /** null = geschlossen. */
  table: CompanyTable | null;
  /** Was im Suchfeld stand — als Vorschlag für den Namen. */
  initialName: string;
  onClose: () => void;
  onCreated: (company: { name: string; address: string }) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { c, scheme } = useAppTheme();
  const { t } = useTranslation();
  const [form, setForm] = useState<NewCompany>(EMPTY);
  const [isSaving, setIsSaving] = useState(false);

  // Bei jedem Öffnen frisch, mit dem gesuchten Namen vorbelegt.
  useEffect(() => {
    if (table) setForm({ ...EMPTY, name: initialName.trim() });
  }, [table, initialName]);

  const set = (field: keyof NewCompany) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!table) return;
    if (!form.name.trim()) {
      showAlert(t('common', 'error'), t('newCompany', 'nameRequired'));
      return;
    }
    setIsSaving(true);
    try {
      const created = await createCompany(table, form);
      onCreated(created);
    } catch (error) {
      showAlert(
        t('common', 'error'),
        error instanceof Error ? error.message : t('newCompany', 'saveFailed')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const field = (
    key: keyof NewCompany,
    label: string,
    options: { autoCapitalize?: 'none' | 'characters' | 'words'; keyboardType?: 'default' | 'number-pad' } = {}
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={form[key]}
        onChangeText={set(key)}
        placeholderTextColor={c.placeholder}
        keyboardAppearance={scheme}
        autoCapitalize={options.autoCapitalize}
        keyboardType={options.keyboardType}
        editable={!isSaving}
      />
    </View>
  );

  return (
    <Modal visible={table !== null} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <BlurSurface
          intensity={30}
          tint="dark"
          fallbackColor="rgba(0,0,0,0.6)"
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {t('newCompany', table === 'carrier_companies' ? 'titleCarrier' : 'titleCustomer')}
            </Text>
            <FluidPressable onPress={onClose} disabled={isSaving}>
              <MaterialIcons name="close" style={styles.closeButton} />
            </FluidPressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {field('name', t('newCompany', 'name'), { autoCapitalize: 'words' })}
            {field('strasse', t('newCompany', 'street'), { autoCapitalize: 'words' })}
            <View style={styles.row}>
              <View style={styles.landField}>
                {field('land', t('newCompany', 'country'), { autoCapitalize: 'characters' })}
              </View>
              <View style={styles.plzField}>{field('plz', t('newCompany', 'postcode'))}</View>
              <View style={styles.ortField}>
                {field('ort', t('newCompany', 'town'), { autoCapitalize: 'words' })}
              </View>
            </View>
            <Text style={styles.hint}>{t('newCompany', 'countryHint')}</Text>
            {table === 'site_companies' && (
              <>
                {field('uidNummer', t('newCompany', 'uid'), { autoCapitalize: 'characters' })}
                {field('bmdKtoNr', t('newCompany', 'bmd'), { autoCapitalize: 'none' })}
                <Text style={styles.hint}>{t('newCompany', 'optionalHint')}</Text>
              </>
            )}

            <FluidPressable
              style={[styles.saveButton, isSaving && styles.disabled]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.saveButtonText}>{t('newCompany', 'save')}</Text>
              )}
            </FluidPressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    overlay: u.modalOverlay,
    sheet: u.modalSheet,
    header: u.modalHeader,
    title: u.modalTitle,
    closeButton: u.closeButton,
    field: {
      marginBottom: Spacing.xs,
    },
    label: {
      ...Typography.caption1,
      fontWeight: '600',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: Spacing.xxs,
    },
    input: {
      ...u.input,
      backgroundColor: c.surfaceSecondary,
      borderColor: 'transparent',
      marginBottom: 0,
    },
    row: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    landField: {
      width: 72,
    },
    plzField: {
      width: 110,
    },
    ortField: {
      flex: 1,
      minWidth: 0,
    },
    hint: {
      ...u.hint,
      marginTop: 0,
      marginBottom: Spacing.sm,
    },
    saveButton: {
      ...u.primaryButton,
      marginTop: Spacing.sm,
      marginBottom: Spacing.md,
    },
    saveButtonText: u.primaryButtonText,
    disabled: u.disabled,
  });
};
