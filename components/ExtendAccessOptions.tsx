import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Spacing } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert } from '@/lib/alert';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

/** Die Schnellwahl beim Verlängern — bei Stammpartnern der Normalfall. */
export const EXTEND_DAY_OPTIONS = [3, 7, 14];

/** Obergrenze für eine eigene Eingabe — schützt vor Tippfehlern wie 3000. */
const MAX_CUSTOM_DAYS = 365;

interface ExtendAccessOptionsProps {
  onExtend: (days: number) => void;
  disabled?: boolean;
}

/**
 * Verlängern eines Fremdfahrer-Zugangs: Schnellwahl (+3/+7/+14 Tage) und ein
 * Feld, in das der Chef eine eigene Anzahl Tage eintragen kann. Gemeinsam
 * genutzt von ExternalAccessPanel, ExternalAccessList und ExpiredAccessCard.
 */
export function ExtendAccessOptions({ onExtend, disabled }: ExtendAccessOptionsProps) {
  const styles = useThemedStyles(createStyles);
  const { c, scheme } = useAppTheme();
  const { t } = useTranslation();
  const [customDays, setCustomDays] = useState('');

  const handleCustomExtend = () => {
    const trimmed = customDays.trim();
    const days = Number(trimmed);
    if (!/^\d+$/.test(trimmed) || days < 1 || days > MAX_CUSTOM_DAYS) {
      showAlert(
        t('common', 'error'),
        t('externalAccess', 'customDaysInvalid').replace('{max}', String(MAX_CUSTOM_DAYS))
      );
      return;
    }
    setCustomDays('');
    onExtend(days);
  };

  return (
    <View style={styles.row}>
      {EXTEND_DAY_OPTIONS.map((days) => (
        <FluidPressable
          key={days}
          style={styles.button}
          onPress={() => onExtend(days)}
          disabled={disabled}
        >
          <Text style={styles.buttonText}>
            {t('externalAccess', 'extendDays').replace('{days}', String(days))}
          </Text>
        </FluidPressable>
      ))}
      <View style={styles.customGroup}>
        <TextInput
          placeholderTextColor={c.placeholder}
          keyboardAppearance={scheme}
          style={styles.input}
          placeholder={t('externalAccess', 'customDaysPlaceholder')}
          value={customDays}
          onChangeText={(text) => setCustomDays(text.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          maxLength={3}
          returnKeyType="done"
          onSubmitEditing={handleCustomExtend}
          editable={!disabled}
        />
        <FluidPressable
          style={[styles.button, !customDays && styles.disabled]}
          onPress={handleCustomExtend}
          disabled={disabled || !customDays}
        >
          <Text style={styles.buttonText}>{t('externalAccess', 'customDaysButton')}</Text>
        </FluidPressable>
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const u = uiStyles(theme);
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.sm,
    },
    customGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    input: {
      ...u.input,
      width: 96,
      marginBottom: 0,
    },
    button: u.smallButton,
    buttonText: u.smallButtonText,
    disabled: u.disabled,
  });
};
