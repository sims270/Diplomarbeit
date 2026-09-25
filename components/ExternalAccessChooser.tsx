import type { ExternalAccess } from '@/app/services/externalDriverAccessService';
import { DateField } from '@/components/DateField';
import { BlurSurface } from '@/components/fluid/BlurSurface';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Spacing } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import { isoToGerman } from '@/lib/dateFormat';
import { useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TextInput, View } from 'react-native';

/** Auswahlwert für "neuen Zugang anlegen" — sonst die user_id eines Zugangs. */
export const NEW_ACCESS = 'new';

interface ExternalAccessChooserProps {
  /** Nur gültige Zugänge — ein abgelaufener lässt sich nicht zuweisen. */
  accesses: ExternalAccess[];
  /** NEW_ACCESS, eine user_id oder '' (noch nichts gewählt) */
  choice: string;
  onChoiceChange: (choice: string) => void;
  label: string;
  onLabelChange: (label: string) => void;
  expiresOn: string;
  onExpiresOnChange: (expiresOn: string) => void;
}

export function formatAccess(access: ExternalAccess, validUntil: string): string {
  return `${access.label} · ${access.username} · ${validUntil} ${isoToGerman(access.expiresOn)}`;
}

/**
 * Bestehenden Zugang wählen oder einen neuen anlegen lassen — beim Anlegen
 * eines Fremdauftrags (app/chef/external-order/new.tsx) und auf der
 * Detailseite (components/ExternalAccessPanel.tsx). Angelegt wird hier
 * nichts; das entscheidet der Bildschirm beim Speichern.
 *
 * Gibt es noch keinen gültigen Zugang, entfällt die Auswahl und es bleiben
 * nur die Felder für den neuen.
 */
export function ExternalAccessChooser({
  accesses,
  choice,
  onChoiceChange,
  label,
  onLabelChange,
  expiresOn,
  onExpiresOnChange,
}: ExternalAccessChooserProps) {
  const styles = useThemedStyles(createStyles);
  const { c, scheme } = useAppTheme();
  const { t } = useTranslation();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const hasAccesses = accesses.length > 0;
  const isNew = !hasAccesses || choice === NEW_ACCESS;
  const selected = accesses.find((access) => access.userId === choice);
  const validUntil = t('externalAccess', 'validUntil');

  const pick = (value: string) => {
    onChoiceChange(value);
    setIsPickerOpen(false);
  };

  return (
    <>
      {hasAccesses ? (
        <FluidPressable style={styles.selectField} onPress={() => setIsPickerOpen(true)}>
          <Text style={choice ? styles.selectValue : styles.selectPlaceholder} numberOfLines={2}>
            {selected
              ? formatAccess(selected, validUntil)
              : choice === NEW_ACCESS
                ? t('externalAccess', 'newAccessOption')
                : t('externalAccess', 'pickerTitle')}
          </Text>
          <Text style={styles.selectChevron}>▾</Text>
        </FluidPressable>
      ) : null}

      {isNew ? (
        <>
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            placeholder={t('externalAccess', 'labelPlaceholder')}
            value={label}
            onChangeText={onLabelChange}
          />
          <Text style={styles.fieldLabel}>{t('externalAccess', 'expiresLabel')}</Text>
          <DateField
            value={expiresOn}
            onChange={onExpiresOnChange}
            placeholder={t('externalAccess', 'expiresLabel')}
          />
        </>
      ) : null}

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
              <Text style={styles.modalTitle}>{t('externalAccess', 'pickerTitle')}</Text>
              <FluidPressable onPress={() => setIsPickerOpen(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </FluidPressable>
            </View>
            <FlatList
              data={accesses}
              keyExtractor={(item) => item.userId}
              ListHeaderComponent={
                <FluidPressable style={styles.option} onPress={() => pick(NEW_ACCESS)}>
                  <Text style={styles.optionText}>{t('externalAccess', 'newAccessOption')}</Text>
                </FluidPressable>
              }
              renderItem={({ item }) => (
                <FluidPressable style={styles.option} onPress={() => pick(item.userId)}>
                  <Text style={styles.optionText}>{item.label}</Text>
                  <Text style={styles.optionSubtext}>
                    {`${item.username} · ${validUntil} ${isoToGerman(item.expiresOn)}`}
                  </Text>
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
    selectField: u.field,
    selectValue: { ...u.fieldValue, flexShrink: 1 },
    selectPlaceholder: { ...u.fieldPlaceholder, flexShrink: 1 },
    selectChevron: u.chevron,
    input: u.input,
    fieldLabel: {
      ...u.hint,
      color: c.textSecondary,
      marginTop: Spacing.xs,
      marginBottom: Spacing.xxs,
      paddingHorizontal: Spacing.xxs,
    },
    modalOverlay: u.modalOverlay,
    modalContent: u.modalSheet,
    modalHeader: u.modalHeader,
    modalTitle: u.modalTitle,
    closeButton: u.closeButton,
    option: u.option,
    optionText: u.optionText,
    optionSubtext: u.optionSubtext,
  });
};
