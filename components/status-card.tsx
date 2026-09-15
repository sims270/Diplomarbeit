import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Radius, shadow, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useThemedStyles } from '@/hooks/use-app-theme';

export interface StatusCardProps {
  count: number;
  label: string;
  color: string;
  /** Macht die Kachel antippbar — ohne bleibt sie reine Anzeige. */
  onPress?: () => void;
}

export function StatusCard({ count, label, color, onPress }: StatusCardProps) {
  const styles = useThemedStyles(createStyles);
  const content = (
    <>
      <Text style={styles.count}>{count}</Text>
      <Text style={styles.label}>{label}</Text>
    </>
  );

  return onPress ? (
    <FluidPressable style={[styles.card, { borderTopColor: color }]} onPress={onPress}>
      {content}
    </FluidPressable>
  ) : (
    <View style={[styles.card, { borderTopColor: color }]}>{content}</View>
  );
}

const createStyles = ({ c, scheme }: AppTheme) =>
  StyleSheet.create({
    // iOS-Widget-Kachel: weiche Fläche, Statusfarbe als schmaler Streifen oben
    card: {
      flex: 1,
      minWidth: 96,
      backgroundColor: c.surface,
      borderRadius: Radius.lg,
      borderTopWidth: 4,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      ...shadow(2, scheme),
    },
    count: {
      ...Typography.title1,
      fontSize: 32,
      lineHeight: 38,
      color: c.text,
      marginBottom: Spacing.xxs,
      fontVariant: ['tabular-nums'],
    },
    label: {
      ...Typography.caption1,
      fontWeight: '600',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      textAlign: 'center',
    },
  });
