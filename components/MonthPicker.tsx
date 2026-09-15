import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import { currentMonth, formatMonth, shiftMonth } from '@/lib/month';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Monatsauswahl "‹ September 2026 ›" — dieselbe in der Umsatz-Tankliste des
 * Chefs und bei den Aufträgen. Über den laufenden Monat hinaus lässt sich
 * nicht blättern, da gibt es noch nichts.
 */
export function MonthPicker({
  month,
  onChange,
}: {
  /** 'YYYY-MM', siehe lib/month.ts */
  month: string;
  onChange: (month: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { t, language } = useTranslation();
  const isCurrentMonth = month >= currentMonth();

  return (
    <View style={styles.row}>
      <FluidPressable
        style={styles.button}
        onPress={() => onChange(shiftMonth(month, -1))}
        accessibilityLabel={t('chefTankliste', 'prevMonth')}
      >
        <Text style={styles.buttonText}>‹</Text>
      </FluidPressable>
      <Text style={styles.label}>{formatMonth(month, language)}</Text>
      <FluidPressable
        style={[styles.button, isCurrentMonth && styles.buttonDisabled]}
        onPress={() => onChange(shiftMonth(month, 1))}
        disabled={isCurrentMonth}
        accessibilityLabel={t('chefTankliste', 'nextMonth')}
      >
        <Text style={styles.buttonText}>›</Text>
      </FluidPressable>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    button: {
      width: Layout.minTouch,
      height: Layout.minTouch,
      borderRadius: Radius.pill,
      backgroundColor: c.surfaceTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDisabled: u.disabled,
    buttonText: {
      ...Typography.title3,
      color: c.text,
    },
    label: {
      ...Typography.headline,
      color: c.text,
      textAlign: 'center',
      flexShrink: 1,
    },
  });
};
