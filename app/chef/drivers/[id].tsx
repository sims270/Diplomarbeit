import {
  formatVehicle,
  getActiveVehicles,
  type Vehicle,
} from '@/app/services/licensePlateService';
import { BlurSurface } from '@/components/fluid/BlurSurface';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Colors } from '@/constants/theme';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert, showConfirm } from '@/lib/alert';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function EditDriverScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    id: string;
    username?: string;
    licensePlate?: string;
  }>();
  const driverId = params.id;

  const [username, setUsername] = useState(params.username ?? '');
  const [licensePlate, setLicensePlate] = useState(params.licensePlate ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isPlatePickerOpen, setIsPlatePickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // Fehlschlag heißt hier nur: keine Auswahl. Benutzername und Passwort
    // lassen sich trotzdem ändern.
    getActiveVehicles()
      .then(setVehicles)
      .catch(() => setVehicles([]));
  }, []);

  const selectedVehicle = vehicles.find((vehicle) => vehicle.plate === licensePlate);

  const handleSave = async () => {
    const trimmedUsername = username.trim();
    const trimmedPlate = licensePlate.trim();
    // Ein geleertes Kennzeichen ist eine echte Änderung (Fahrer hat keinen
    // festen LKW mehr), deshalb zählt hier der Vergleich mit dem Wert, mit
    // dem der Screen geöffnet wurde — nicht, ob das Feld gefüllt ist.
    const plateChanged = trimmedPlate !== (params.licensePlate ?? '');

    if (!trimmedUsername && !newPassword.trim() && !plateChanged) {
      showAlert(t('common', 'error'), t('editDriver', 'alertNoChanges'));
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-driver', {
        body: {
          userId: driverId,
          ...(trimmedUsername ? { username: trimmedUsername } : {}),
          ...(newPassword.trim() ? { password: newPassword.trim() } : {}),
          ...(plateChanged ? { licensePlate: trimmedPlate } : {}),
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error ?? error?.message ?? 'Unknown error');
      }

      showAlert(t('common', 'success'), `${trimmedUsername || t('common', 'unknown')} ${t('editDriver', 'alertSaved')}`);
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      showAlert(t('common', 'error'), message || t('editDriver', 'alertSaveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    const label = params.username || t('common', 'unknown');

    showConfirm(
      t('editDriver', 'deleteConfirmTitle'),
      `"${label}" ${t('editDriver', 'deleteConfirmMessage')}`,
      async () => {
        setIsDeleting(true);
        try {
          const { data, error } = await supabase.functions.invoke('delete-driver', {
            body: { userId: driverId },
          });

          if (error || data?.error) {
            throw new Error(data?.error ?? error?.message ?? 'Unknown error');
          }

          showAlert(t('common', 'success'), `"${label}" ${t('editDriver', 'alertDeleted')}`);
          router.back();
        } catch (error) {
          const message = error instanceof Error ? error.message : undefined;
          showAlert(t('common', 'error'), message || t('editDriver', 'alertDeleteFailed'));
        } finally {
          setIsDeleting(false);
        }
      },
      {
        confirmText: t('editDriver', 'deleteConfirmConfirm'),
        cancelText: t('editDriver', 'deleteConfirmCancel'),
        destructive: true,
      }
    );
  };

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('editDriver', 'headerSubtitle')} code="CH" />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <FluidPressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('editDriver', 'title')}</Text>

          <Text style={styles.label}>{t('editDriver', 'usernameLabel')}</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            editable={!isSaving}
            autoCapitalize="none"
          />

          <Text style={styles.label}>{t('editDriver', 'vehicleLabel')}</Text>
          {/* Reines Auswahlfeld: Zugeteilt wird ein LKW aus der Flotte, und
              den legt der Chef in der LKW-Verwaltung an — dort gehören
              Marke und Baujahr dazu. Ein hier frei getipptes Kennzeichen
              erzeugte dagegen einen LKW ohne jede Fahrzeugangabe. */}
          <FluidPressable
            style={styles.selectField}
            onPress={() => setIsPlatePickerOpen(true)}
            disabled={isSaving}
          >
            <Text style={licensePlate ? styles.selectValue : styles.selectPlaceholder}>
              {selectedVehicle
                ? formatVehicle(selectedVehicle)
                : licensePlate || t('editDriver', 'vehiclePlaceholder')}
            </Text>
            <Text style={styles.comboChevron}>▾</Text>
          </FluidPressable>

          <Text style={styles.label}>{t('editDriver', 'newPasswordLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('editDriver', 'newPasswordPlaceholder')}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            editable={!isSaving}
            autoCapitalize="none"
          />

          <FluidPressable
            style={[styles.saveButton, (isSaving || isDeleting) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={isSaving || isDeleting}
          >
            {isSaving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.saveButtonText}>{t('editDriver', 'saveButton')}</Text>
            )}
          </FluidPressable>
        </View>

        <FluidPressable
          style={[styles.deleteButton, (isSaving || isDeleting) && styles.buttonDisabled]}
          onPress={handleDelete}
          disabled={isSaving || isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator color={Colors.ui.primary} />
          ) : (
            <Text style={styles.deleteButtonText}>{t('editDriver', 'deleteButton')}</Text>
          )}
        </FluidPressable>
      </ScrollView>

      <Modal
        visible={isPlatePickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPlatePickerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurSurface
            intensity={30}
            tint="dark"
            fallbackColor="rgba(0,0,0,0.6)"
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('editDriver', 'vehicleLabel')}</Text>
              <FluidPressable onPress={() => setIsPlatePickerOpen(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </FluidPressable>
            </View>
            {vehicles.length === 0 ? (
              <Text style={styles.emptyPickerText}>
                {t('editDriver', 'noVehiclesYet')}
              </Text>
            ) : (
              <FlatList
                data={vehicles}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={
                  // Zuteilung wieder aufheben: Ohne diesen Eintrag ließe
                  // sich ein einmal zugeteilter LKW nie mehr entfernen.
                  <FluidPressable
                    style={styles.pickerOption}
                    onPress={() => {
                      setLicensePlate('');
                      setIsPlatePickerOpen(false);
                    }}
                  >
                    <Text style={styles.pickerOptionMuted}>
                      {t('editDriver', 'vehicleNone')}
                    </Text>
                  </FluidPressable>
                }
                renderItem={({ item }) => (
                  <FluidPressable
                    style={styles.pickerOption}
                    onPress={() => {
                      setLicensePlate(item.plate);
                      setIsPlatePickerOpen(false);
                    }}
                  >
                    <Text style={styles.pickerOptionText}>{formatVehicle(item)}</Text>
                  </FluidPressable>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.lightGray,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 24,
  },
  backButton: {
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.primary,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    color: Colors.ui.charcoal,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.darkGray,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 14,
    color: Colors.ui.charcoal,
  },
  selectField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    backgroundColor: 'white',
  },
  selectValue: {
    flex: 1,
    fontSize: 14,
    color: Colors.ui.charcoal,
  },
  selectPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: '#9a9a9a',
  },
  comboChevron: {
    fontSize: 14,
    color: Colors.ui.darkGray,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  emptyPickerText: {
    fontSize: 13,
    color: Colors.ui.darkGray,
    lineHeight: 19,
    textAlign: 'center',
    paddingVertical: 24,
  },
  pickerOption: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: Colors.ui.lightGray,
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.charcoal,
  },
  pickerOptionMuted: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.darkGray,
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: Colors.ui.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: Colors.ui.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  deleteButtonText: {
    color: Colors.ui.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
