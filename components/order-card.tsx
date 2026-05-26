import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

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

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderLeftWidth: 5,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  id: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.ui.darkGray,
  },
  badge: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  company: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
  },
  address: {
    fontSize: 13,
    color: Colors.ui.darkGray,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
  },
  detail: {
    fontSize: 12,
    color: Colors.ui.darkGray,
  },
});
