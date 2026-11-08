import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurSurface } from '@/components/fluid/BlurSurface';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Spacing, Typography } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert } from '@/lib/alert';
import { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, View } from 'react-native';

interface DeleteOrderModalProps {
  visible: boolean;
  orderNr: string;
  onClose: () => void;
  /** Löscht den Auftrag; wirft bei einem Fehler. */
  onDelete: () => Promise<void>;
}

/**
 * Bestätigung vor dem Löschen eines Auftrags. Ein einfaches Ja/Nein ist zu
 * schnell weggeklickt — gelöscht wird erst, wenn der Chef das
 * Bestätigungswort eintippt. Ein eigenes Modal, weil showConfirm im Web nur
 * window.confirm kennt und dort kein Eingabefeld hat.
 */
export function DeleteOrderModal({ visible, orderNr, onClose, onDelete }: DeleteOrderModalProps) {
  const styles = useThemedStyles(createStyles);
  const { c, scheme } = useAppTheme();
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmWord = t('deleteOrder', 'confirmWord');
  const isConfirmed = typed.trim().toUpperCase() === confirmWord.toUpperCase();

  const handleClose = () => {
    if (isDeleting) return;
    setTyped('');
    onClose();
  };

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete();
      setTyped('');
    } catch (error) {
      showAlert(
        t('common', 'error'),
        error instanceof Error ? error.message : t('deleteOrder', 'failed')
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <BlurSurface
          intensity={30}
          tint="dark"
          fallbackColor="rgba(0,0,0,0.6)"
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('deleteOrder', 'title')}</Text>
            <FluidPressable onPress={handleClose}>
              <MaterialIcons name="close" style={styles.closeButton} />
            </FluidPressable>
          </View>

          <Text style={styles.text}>
            {t('deleteOrder', 'message').replace('{orderNr}', orderNr)}
          </Text>
          <Text style={styles.prompt}>
            {t('deleteOrder', 'prompt').replace('{word}', confirmWord)}
          </Text>

          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            placeholder={confirmWord}
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            editable={!isDeleting}
            returnKeyType="done"
            onSubmitEditing={handleDelete}
          />

          <View style={styles.buttonRow}>
            <FluidPressable style={styles.cancelButton} onPress={handleClose} disabled={isDeleting}>
              <Text style={styles.cancelButtonText}>{t('common', 'cancel')}</Text>
            </FluidPressable>
            <FluidPressable
              style={[styles.deleteButton, (!isConfirmed || isDeleting) && styles.disabled]}
              onPress={handleDelete}
              disabled={!isConfirmed || isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator color={c.danger} />
              ) : (
                <Text style={styles.deleteButtonText}>{t('deleteOrder', 'confirmButton')}</Text>
              )}
            </FluidPressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    overlay: u.modalOverlay,
    sheet: u.modalSheet,
    header: u.modalHeader,
    title: u.modalTitle,
    closeButton: u.closeButton,
    text: {
      ...Typography.body,
      color: c.text,
    },
    prompt: {
      ...Typography.subhead,
      color: c.textSecondary,
      marginTop: Spacing.md,
      marginBottom: Spacing.xs,
    },
    input: u.input,
    buttonRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
      marginTop: Spacing.md,
    },
    cancelButton: {
      ...u.secondaryButton,
      flex: 1,
    },
    cancelButtonText: u.secondaryButtonText,
    deleteButton: {
      ...u.secondaryButton,
      flex: 1,
      backgroundColor: c.dangerSoft,
    },
    deleteButtonText: {
      ...u.secondaryButtonText,
      color: c.danger,
    },
    disabled: u.disabled,
  });
};
