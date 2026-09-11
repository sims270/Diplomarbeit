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
import { showAlert } from '@/lib/alert';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
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

export default function CreateDriverScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // Zugeteilt wird der LKW, nicht das Kennzeichen — das gehört zum
  // Fahrzeug und kommt mit ihm. Gespeichert wird trotzdem das Kennzeichen:
  // Es ist der Schlüssel, über den die Tankungen des Fahrers seinem LKW
  // zugeordnet werden (siehe supabase/migrations/20260911110000).
  const [licensePlate, setLicensePlate] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isPlatePickerOpen, setIsPlatePickerOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    // Fehlschlag heißt hier nur: keine Auswahl. Der Fahrer lässt sich
    // trotzdem anlegen, der LKW wird später zugeteilt.
    getActiveVehicles()
      .then(setVehicles)
      .catch(() => setVehicles([]));
  }, []);

  const selectedVehicle = vehicles.find((vehicle) => vehicle.plate === licensePlate);

  const handleCreateDriver = async () => {
    if (!username.trim() || !password.trim()) {
      showAlert(t('common', 'error'), t('createDriver', 'alertFillFields'));
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-driver', {
        body: {
          username: username.trim(),
          password,
          licensePlate: licensePlate.trim(),
        },
      });

      // supabase-js only rejects `error` for transport/network failures;
      // our function returns 4xx/5xx bodies with an `error` field on
      // failure, so both cases need checking here.
      if (error || data?.error) {
        throw new Error(data?.error ?? error?.message ?? 'Unknown error');
      }

      showAlert(t('common', 'success'), `"${username}" ${t('createDriver', 'alertDriverCreated')}`);
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      showAlert(t('common', 'error'), message || t('createDriver', 'alertCreateFailed'));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('createDriver', 'headerSubtitle')} code="CH" />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <FluidPressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('createDriver', 'title')}</Text>
          <Text style={styles.sectionDescription}>{t('createDriver', 'description')}</Text>

          <TextInput
            style={styles.input}
            placeholder={t('createDriver', 'usernamePlaceholder')}
            value={username}
            onChangeText={setUsername}
            editable={!isCreating}
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder={t('createDriver', 'passwordPlaceholder')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isCreating}
            autoCapitalize="none"
          />

          {/* Reines Auswahlfeld: Zugeteilt wird ein LKW aus der Flotte, und
              den legt der Chef in der LKW-Verwaltung an — dort gehören
              Marke und Baujahr dazu. Ein hier frei getipptes Kennzeichen
              erzeugte dagegen einen LKW ohne jede Fahrzeugangabe. */}
          <FluidPressable
            style={styles.selectField}
            onPress={() => setIsPlatePickerOpen(true)}
            disabled={isCreating}
          >
            <Text style={licensePlate ? styles.selectValue : styles.selectPlaceholder}>
              {selectedVehicle
                ? formatVehicle(selectedVehicle)
                : licensePlate || t('createDriver', 'vehiclePlaceholder')}
            </Text>
            <Text style={styles.comboChevron}>▾</Text>
          </FluidPressable>

          <FluidPressable
            style={[styles.createButton, isCreating && styles.buttonDisabled]}
            onPress={handleCreateDriver}
            disabled={isCreating}
          >
            {isCreating ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.createButtonText}>{t('createDriver', 'createButton')}</Text>
            )}
          </FluidPressable>
        </View>
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
              <Text style={styles.modalTitle}>{t('createDriver', 'vehicleLabel')}</Text>
              <FluidPressable onPress={() => setIsPlatePickerOpen(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </FluidPressable>
            </View>
            {vehicles.length === 0 ? (
              <Text style={styles.emptyPickerText}>
                {t('createDriver', 'noVehiclesYet')}
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
                      {t('createDriver', 'vehicleNone')}
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
    marginBottom: 4,
    color: Colors.ui.charcoal,
  },
  sectionDescription: {
    fontSize: 13,
    color: Colors.ui.darkGray,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
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
    marginBottom: 12,
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
  createButton: {
    backgroundColor: Colors.ui.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
