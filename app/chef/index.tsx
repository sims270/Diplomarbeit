import { StyleSheet, ScrollView, View, Text, Pressable, Modal, TextInput, ActivityIndicator } from 'react-native';
import { Header } from '@/components/header';
import { StatusCard } from '@/components/status-card';
import { Colors } from '@/constants/theme';
import { useState } from 'react';

export default function ChefDashboardScreen() {
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);
  const [driverForm, setDriverForm] = useState({ username: '', password: '', name: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateDriver = async () => {
    if (!driverForm.username.trim() || !driverForm.password.trim() || !driverForm.name.trim()) {
      alert('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('Creating driver:', driverForm);
      alert(`Driver "${driverForm.name}" created successfully!`);
      setDriverForm({ username: '', password: '', name: '' });
      setShowAddDriverModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="TRANSLOG PRO"
        subtitle="CHEF-DASHBOARD"
        code="CH"
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusContainer}>
          <StatusCard
            count={0}
            label="OFFEN"
            color={Colors.ui.orange}
          />
          <StatusCard
            count={0}
            label="UNTERWEGS"
            color={Colors.ui.blue}
          />
          <StatusCard
            count={0}
            label="ERLEDIGT"
            color={Colors.ui.green}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>AUFTRÄGE HEUTE</Text>
            <Pressable style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Neu</Text>
            </Pressable>
          </View>

          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Keine Aufträge vorhanden</Text>
            <Text style={styles.emptyStateSubtext}>
              Aufträge werden später mit der Datenbank verbunden
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>FAHRER VERWALTEN</Text>
            <Pressable
              style={styles.addButton}
              onPress={() => setShowAddDriverModal(true)}
            >
              <Text style={styles.addButtonText}>+ Fahrer</Text>
            </Pressable>
          </View>
          <Text style={styles.driverText}>
            Füge hier neue Fahrer hinzu und verwalte bestehende Fahrer.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={showAddDriverModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddDriverModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>NEUEN FAHRER ERSTELLEN</Text>
              <Pressable onPress={() => setShowAddDriverModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Name"
              value={driverForm.name}
              onChangeText={(text) => setDriverForm({ ...driverForm, name: text })}
              editable={!isSubmitting}
            />

            <TextInput
              style={styles.input}
              placeholder="Username"
              value={driverForm.username}
              onChangeText={(text) => setDriverForm({ ...driverForm, username: text })}
              autoCapitalize="none"
              editable={!isSubmitting}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              value={driverForm.password}
              onChangeText={(text) => setDriverForm({ ...driverForm, password: text })}
              secureTextEntry
              editable={!isSubmitting}
            />

            <View style={styles.modalButtonContainer}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddDriverModal(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>Abbrechen</Text>
              </Pressable>

              <Pressable
                style={[styles.modalButton, styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleCreateDriver}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.submitButtonText}>ERSTELLEN</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  statusContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    textTransform: 'uppercase',
  },
  addButton: {
    backgroundColor: Colors.ui.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  driverText: {
    fontSize: 14,
    color: Colors.ui.mediumGray,
    lineHeight: 20,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  closeButton: {
    fontSize: 24,
    color: Colors.ui.darkGray,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.ui.lightGray,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 14,
    color: Colors.light.text,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.ui.lightGray,
  },
  cancelButtonText: {
    color: Colors.light.text,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: Colors.ui.primary,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});
