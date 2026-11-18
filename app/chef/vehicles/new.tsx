import {
  addVehicle,
  getVehicles,
  MAX_YEAR_BUILT,
  MIN_YEAR_BUILT,
  type Vehicle,
} from '@/app/services/licensePlateService';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Spacing, Typography } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert } from '@/lib/alert';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

/**
 * Einen LKW eintragen. Der Kilometerstand wird bewusst nicht eingetippt: Er
 * kommt aus der Tankliste und wird von einem Trigger nachgezogen.
 */
export default function CreateVehicleScreen() {
  const styles = useThemedStyles(createStyles);
  const { c, scheme } = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    // Nur für den Hinweis auf Doppelte. Fehlt die Liste, lehnt die Datenbank
    // ein vorhandenes Kennzeichen trotzdem ab.
    getVehicles()
      .then(setVehicles)
      .catch(() => setVehicles([]));
  }, []);

  const handleAdd = async () => {
    const cleanPlate = plate.trim().toUpperCase();
    if (!cleanPlate) {
      showAlert(t('common', 'error'), t('vehicles', 'alertEmptyPlate'));
      return;
    }

    if (vehicles.some((vehicle) => vehicle.plate.toUpperCase() === cleanPlate)) {
      showAlert(t('common', 'error'), `"${cleanPlate}" ${t('vehicles', 'alertDuplicate')}`);
      return;
    }

    // Das Baujahr ist optional. Steht etwas drin, muss es eine plausible
    // Jahreszahl sein: Ein Vertipper wie 20019 ginge sonst als Baujahr durch.
    const trimmedYear = year.trim();
    let yearBuilt: number | null = null;
    if (trimmedYear) {
      const parsed = Number(trimmedYear);
      if (!Number.isInteger(parsed) || parsed < MIN_YEAR_BUILT || parsed > MAX_YEAR_BUILT) {
        showAlert(t('common', 'error'), t('vehicles', 'alertInvalidYear'));
        return;
      }
      yearBuilt = parsed;
    }

    setIsAdding(true);
    try {
      await addVehicle({ plate: cleanPlate, model, yearBuilt });
      showAlert(t('common', 'success'), `"${cleanPlate}" ${t('vehicles', 'alertAdded')}`);
      router.back();
    } catch (error) {
      showAlert(
        t('common', 'error'),
        error instanceof Error ? error.message : t('vehicles', 'alertAddFailed')
      );
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('vehicles', 'newHeaderSubtitle')} code="CH" />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        keyboardShouldPersistTaps="handled"
      >
        <FluidPressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('vehicles', 'addSectionTitle')}</Text>
          <Text style={styles.sectionDescription}>{t('vehicles', 'hint')}</Text>

          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            value={plate}
            onChangeText={setPlate}
            placeholder={t('vehicles', 'addPlaceholder')}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isAdding}
          />
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            value={model}
            onChangeText={setModel}
            placeholder={t('vehicles', 'modelPlaceholder')}
            editable={!isAdding}
          />
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            value={year}
            onChangeText={setYear}
            placeholder={t('vehicles', 'yearPlaceholder')}
            keyboardType="numeric"
            maxLength={4}
            editable={!isAdding}
            onSubmitEditing={handleAdd}
          />

          <FluidPressable
            style={[styles.createButton, isAdding && styles.buttonDisabled]}
            onPress={handleAdd}
            disabled={isAdding}
          >
            {isAdding ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.createButtonText}>{t('vehicles', 'addButton')}</Text>
            )}
          </FluidPressable>
        </View>
      </ScrollView>
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
    sectionTitle: {
      ...Typography.title3,
      marginBottom: Spacing.xxs,
      color: c.text,
    },
    sectionDescription: {
      ...Typography.subhead,
      color: c.textSecondary,
      marginBottom: Spacing.md,
    },
    input: {
      ...u.input,
      backgroundColor: c.surfaceSecondary,
      borderColor: 'transparent',
      marginBottom: Spacing.sm,
    },
    createButton: {
      ...u.primaryButton,
      marginTop: Spacing.xs,
    },
    createButtonText: u.primaryButtonText,
    buttonDisabled: u.disabled,
  });
};
