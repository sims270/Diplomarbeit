import {
  formatVehicle,
  getActiveVehicles,
  type Vehicle,
} from '@/app/services/licensePlateService';
import { BlurSurface } from '@/components/fluid/BlurSurface';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
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
  const styles = useThemedStyles(createStyles);
  const { c, scheme } = useAppTheme();
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
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
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
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
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
            <ActivityIndicator color={c.tint} />
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

const createStyles = (theme: AppTheme) => {
  const { c } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    container: u.screen,
    content: {
      flex: 1,
    },
    contentInner: u.narrowColumn,
    backButton: u.backButton,
    backButtonText: u.backButtonText,
    card: u.card,
    input: {
      ...u.input,
      backgroundColor: c.surfaceSecondary,
      borderColor: 'transparent',
      marginBottom: Spacing.sm,
    },
    selectField: {
      ...u.field,
      backgroundColor: c.surfaceSecondary,
      borderColor: 'transparent',
      marginBottom: Spacing.sm,
    },
    selectValue: {
      ...u.fieldValue,
      flex: 1,
    },
    selectPlaceholder: {
      ...u.fieldPlaceholder,
      flex: 1,
    },
    comboChevron: u.chevron,
    modalOverlay: u.modalOverlay,
    modalContent: u.modalSheet,
    modalHeader: u.modalHeader,
    modalTitle: u.modalTitle,
    closeButton: u.closeButton,
    emptyPickerText: {
      ...u.emptyStateSubtext,
      paddingVertical: Spacing.lg,
    },
    pickerOption: u.option,
    pickerOptionText: u.optionText,
    pickerOptionMuted: {
      ...u.optionText,
      color: c.textSecondary,
      fontStyle: 'italic',
    },
    buttonDisabled: u.disabled,
    sectionTitle: {
      ...Typography.title3,
      marginBottom: Spacing.md,
      color: c.text,
    },
    label: {
      ...Typography.caption1,
      fontWeight: '600',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: Spacing.xs - 2,
    },
    saveButton: {
      ...u.primaryButton,
      marginTop: Spacing.xs,
    },
    saveButtonText: u.primaryButtonText,
    deleteButton: {
      ...u.tintedButton,
      marginTop: Spacing.md,
    },
    deleteButtonText: u.tintedButtonText,
  });
};
