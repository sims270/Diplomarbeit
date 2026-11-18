import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import { currentMonth } from '@/lib/month';
import {
  ALL_PERIOD,
  currentYear,
  formatPeriod,
  type PeriodKind,
  periodKind,
  shiftPeriod,
  TODAY_PERIOD,
} from '@/lib/orderPeriod';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

// Die Knöpfe sind bewusst klein, die Tippfläche bleibt trotzdem groß genug.
const HIT_SLOP = { top: 8, bottom: 8, left: 4, right: 4 };

/**
 * Zeitraum der Auftragsansichten: Heute, Monat, Jahr oder Alle, als schmale
 * Zeile über der Liste. Bei Monat und Jahr lässt sich auch nach vorne blättern,
 * denn Aufträge werden im Voraus geplant.
 */
export function OrderPeriodFilter({
  period,
  onChange,
}: {
  /** Siehe lib/orderPeriod.ts */
  period: string;
  onChange: (period: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { t, language } = useTranslation();
  const kind = periodKind(period);

  // Beim Zurückwechseln steht wieder der zuletzt gewählte Monat oder das Jahr.
  const [lastMonth, setLastMonth] = useState(kind === 'month' ? period : currentMonth());
  const [lastYear, setLastYear] = useState(kind === 'year' ? period : currentYear());

  const options: { kind: PeriodKind; label: string; value: string }[] = [
    { kind: 'today', label: t('chefOrdersList', 'periodToday'), value: TODAY_PERIOD },
    { kind: 'month', label: t('chefOrdersList', 'periodMonth'), value: lastMonth },
    { kind: 'year', label: t('chefOrdersList', 'periodYear'), value: lastYear },
    { kind: 'all', label: t('chefOrdersList', 'periodAll'), value: ALL_PERIOD },
  ];

  const step = (delta: number) => {
    const next = shiftPeriod(period, delta);
    if (kind === 'year') setLastYear(next);
    else setLastMonth(next);
    onChange(next);
  };

  return (
    <View style={styles.bar}>
      <View style={styles.options}>
        {options.map((option) => {
          const isActive = option.kind === kind;
          return (
            <FluidPressable
              key={option.kind}
              style={[styles.option, isActive && styles.optionActive]}
              onPress={() => onChange(option.value)}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[styles.optionText, isActive && styles.optionTextActive]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
            </FluidPressable>
          );
        })}
      </View>

      {(kind === 'month' || kind === 'year') && (
        <View style={styles.stepper}>
          <FluidPressable
            style={styles.stepButton}
            onPress={() => step(-1)}
            hitSlop={HIT_SLOP}
            accessibilityLabel={t('chefOrdersList', 'periodPrevious')}
          >
            <Text style={styles.stepButtonText}>‹</Text>
          </FluidPressable>
          <Text style={styles.stepLabel}>{formatPeriod(period, language)}</Text>
          <FluidPressable
            style={styles.stepButton}
            onPress={() => step(1)}
            hitSlop={HIT_SLOP}
            accessibilityLabel={t('chefOrdersList', 'periodNext')}
          >
            <Text style={styles.stepButtonText}>›</Text>
          </FluidPressable>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c } = theme;
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: Spacing.sm,
      rowGap: Spacing.xxs,
      marginBottom: Spacing.sm,
    },
    options: {
      flexDirection: 'row',
      gap: Spacing.xxs,
    },
    option: {
      minHeight: 28,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.sm,
      borderRadius: Radius.pill,
    },
    optionActive: {
      backgroundColor: c.surfaceTertiary,
    },
    optionText: {
      ...Typography.footnote,
      color: c.textSecondary,
    },
    optionTextActive: {
      fontWeight: '600',
      color: c.text,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xxs,
    },
    stepButton: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepButtonText: {
      ...Typography.headline,
      color: c.textSecondary,
    },
    stepLabel: {
      ...Typography.footnote,
      fontWeight: '600',
      color: c.textSecondary,
      textAlign: 'center',
    },
  });
};
