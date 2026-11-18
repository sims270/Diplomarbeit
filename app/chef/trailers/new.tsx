import { addTrailer, getTrailers, type Trailer } from '@/app/services/trailerService';
import { DateField } from '@/components/DateField';
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
 * Einen Auflieger eintragen. Genehmigungen kommen erst im Bearbeiten-Screen
 * dazu, dafür braucht es den angelegten Auflieger.
 */
export default function CreateTrailerScreen() {
  const styles = useThemedStyles(createStyles);
  const { c, scheme } = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const [plate, setPlate] = useState('');
  const [description, setDescription] = useState('');
  const [pickerlDate, setPickerlDate] = useState('');
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    // Nur für den Hinweis auf Doppelte. Fehlt die Liste, lehnt die Datenbank
    // ein vorhandenes Kennzeichen trotzdem ab.
    getTrailers()
      .then(setTrailers)
      .catch(() => setTrailers([]));
  }, []);

  const handleAdd = async () => {
    const cleanPlate = plate.trim().toUpperCase();
    if (!cleanPlate) {
      showAlert(t('common', 'error'), t('trailers', 'alertEmptyPlate'));
      return;
    }

    if (trailers.some((trailer) => trailer.plate.toUpperCase() === cleanPlate)) {
      showAlert(t('common', 'error'), `"${cleanPlate}" ${t('trailers', 'alertDuplicate')}`);
      return;
    }

    setIsAdding(true);
    try {
      await addTrailer({
        plate: cleanPlate,
        description,
        pickerlDueDate: pickerlDate || null,
      });
      showAlert(t('common', 'success'), `"${cleanPlate}" ${t('trailers', 'alertAdded')}`);
      router.back();
    } catch (error) {
      showAlert(
        t('common', 'error'),
        error instanceof Error ? error.message : t('trailers', 'alertAddFailed')
      );
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('trailers', 'newHeaderSubtitle')} code="CH" />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        keyboardShouldPersistTaps="handled"
      >
        <FluidPressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('trailers', 'addSectionTitle')}</Text>
          <Text style={styles.sectionDescription}>{t('trailers', 'hint')}</Text>

          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            value={plate}
            onChangeText={setPlate}
            placeholder={t('trailers', 'addPlaceholder')}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isAdding}
          />
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder={t('trailers', 'descriptionPlaceholder')}
            editable={!isAdding}
          />
          <DateField
            value={pickerlDate}
            onChange={setPickerlDate}
            placeholder={t('trailers', 'pickerlPlaceholder')}
          />

          <FluidPressable
            style={[styles.createButton, isAdding && styles.buttonDisabled]}
            onPress={handleAdd}
            disabled={isAdding}
          >
            {isAdding ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.createButtonText}>{t('trailers', 'addButton')}</Text>
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
