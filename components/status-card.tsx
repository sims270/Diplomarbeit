import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Radius, shadow, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useThemedStyles } from '@/hooks/use-app-theme';

export interface StatusCardProps {
  count: number;
  label: string;
  color: string;
}

export function StatusCard({ count, label, color }: StatusCardProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.card, { borderTopColor: color }]}>
      <Text style={styles.count}>{count}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
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
