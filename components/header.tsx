import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  code?: string;
}

export function Header({ title, subtitle, code }: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {code && <Text style={styles.code}>{code}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.ui.primary,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  code: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
});
