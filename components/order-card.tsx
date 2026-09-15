import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, shadow, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useThemedStyles } from '@/hooks/use-app-theme';

export interface OrderCardProps {
  id: string;
  company: string;
  address: string;
  time: string;
  packages: number;
  weight: number;
  status: 'offen' | 'unterwegs' | 'erledigt';
}

const statusColors = {
  offen: { color: Colors.ui.orange, label: 'OFFEN' },
  unterwegs: { color: Colors.ui.blue, label: 'UNTERWEGS' },
  erledigt: { color: Colors.ui.green, label: 'ABGESCHLOSSEN' },
};

export function OrderCard({ id, company, address, time, packages, weight, status }: OrderCardProps) {
  const styles = useThemedStyles(createStyles);
  const statusInfo = statusColors[status];

  return (
    <View style={[styles.card, { borderLeftColor: statusInfo.color }]}>
      <View style={styles.header}>
        <Text style={styles.id}>{id}</Text>
        <Text style={[styles.badge, { backgroundColor: statusInfo.color }]}>
          {statusInfo.label}
        </Text>
      </View>

      <Text style={styles.company}>{company}</Text>
      <Text style={styles.address}>📍 {address}</Text>

      <View style={styles.footer}>
        <Text style={styles.detail}>⏰ {time} Uhr</Text>
        <Text style={styles.detail}>📦 {packages} Pakete</Text>
        <Text style={styles.detail}>⚖️ {weight} kg</Text>
      </View>
    </View>
  );
}

const createStyles = ({ c, scheme }: AppTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: Radius.lg,
      borderLeftWidth: 4,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      overflow: 'hidden',
      ...shadow(2, scheme),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.xs,
      marginBottom: Spacing.xs,
    },
    id: {
      ...Typography.footnote,
      fontWeight: '600',
      color: c.textSecondary,
    },
    badge: {
      ...Typography.caption2,
      color: 'white',
      fontWeight: '700',
      letterSpacing: 0.4,
      paddingHorizontal: Spacing.xs,
      paddingVertical: Spacing.xxs,
      borderRadius: Radius.pill,
      overflow: 'hidden',
    },
    company: {
      ...Typography.headline,
      color: c.text,
      marginBottom: Spacing.xxs,
    },
    address: {
      ...Typography.subhead,
      color: c.textSecondary,
      marginBottom: Spacing.sm,
    },
    footer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    detail: {
      ...Typography.footnote,
      color: c.textSecondary,
    },
  });
