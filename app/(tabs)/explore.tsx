import { StyleSheet, ScrollView, View, Text } from 'react-native';
import { Header } from '@/components/header';
import { OrderCard } from '@/components/order-card';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

export default function DriverDashboardScreen() {
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <Header
        title="TRANSLOG PRO"
        subtitle={`FAHRER - ${user?.name || 'Unbekannt'}`}
        code={user?.username?.[0]?.toUpperCase() || 'U'}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MEINE AUFTRÄGE</Text>

          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Keine zugeteilten Aufträge</Text>
            <Text style={styles.emptyStateSubtext}>
              Aufträge werden von deinem Chef zugewiesen
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  emptyState: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: Colors.ui.lightGray,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ui.darkGray,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.ui.mediumGray,
    textAlign: 'center',
  },
});
