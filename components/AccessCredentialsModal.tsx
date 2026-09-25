import { BlurSurface } from '@/components/fluid/BlurSurface';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert } from '@/lib/alert';
import { isoToGerman } from '@/lib/dateFormat';
import { Modal, Platform, Share, StyleSheet, Text, View } from 'react-native';

export interface AccessCredentials {
  username: string;
  password: string;
  expiresOn: string;
}

interface AccessCredentialsModalProps {
  /** null = geschlossen */
  credentials: AccessCredentials | null;
  onClose: () => void;
}

/**
 * Zeigt Benutzername und Passwort eines Fremdfahrer-Zugangs zum
 * Weitergeben — direkt nach dem Anlegen und später über "Passwort
 * anzeigen" beim Auftrag.
 */
export function AccessCredentialsModal({ credentials, onClose }: AccessCredentialsModalProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  const handleShare = async () => {
    if (!credentials) return;
    const message = t('externalAccess', 'shareMessage')
      .replace('{username}', credentials.username)
      .replace('{password}', credentials.password)
      .replace('{expiresOn}', isoToGerman(credentials.expiresOn));

    try {
      await Share.share({ message });
    } catch {
      // Im Desktop-Browser gibt es oft kein Teilen-Menü. Dann wenigstens in
      // die Zwischenablage, zum Einfügen in Mail oder WhatsApp Web.
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(message);
          showAlert(t('externalAccess', 'copied'));
        } catch {
          // Der Text steht markierbar im Dialog.
        }
      }
    }
  };

  return (
    <Modal visible={credentials !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <BlurSurface
          intensity={30}
          tint="dark"
          fallbackColor="rgba(0,0,0,0.6)"
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('externalAccess', 'credentialsTitle')}</Text>
            <FluidPressable onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </FluidPressable>
          </View>

          {credentials ? (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>{t('externalAccess', 'usernameLabel')}</Text>
                <Text style={styles.value} selectable>
                  {credentials.username}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>{t('externalAccess', 'passwordLabel')}</Text>
                <Text style={[styles.value, styles.password]} selectable>
                  {credentials.password}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>{t('externalAccess', 'expiresLabel')}</Text>
                <Text style={styles.value}>{isoToGerman(credentials.expiresOn)}</Text>
              </View>
            </>
          ) : null}

          <Text style={styles.hint}>{t('externalAccess', 'credentialsHint')}</Text>

          <View style={styles.buttonRow}>
            <FluidPressable style={styles.shareButton} onPress={handleShare}>
              <Text style={styles.shareButtonText}>{t('externalAccess', 'shareButton')}</Text>
            </FluidPressable>
            <FluidPressable style={styles.doneButton} onPress={onClose}>
              <Text style={styles.doneButtonText}>{t('externalAccess', 'doneButton')}</Text>
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
    row: {
      paddingVertical: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    label: {
      ...Typography.caption1,
      fontWeight: '600',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 2,
    },
    value: {
      ...Typography.title3,
      color: c.text,
    },
    // Zum Abtippen: gleich breite Zeichen, etwas Luft dazwischen.
    password: {
      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
      letterSpacing: 1.5,
      backgroundColor: c.surfaceSecondary,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.xs,
      alignSelf: 'flex-start',
      overflow: 'hidden',
    },
    hint: {
      ...u.hint,
      marginTop: Spacing.md,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
      marginTop: Spacing.lg,
    },
    shareButton: {
      ...u.secondaryButton,
      flex: 1,
    },
    shareButtonText: u.secondaryButtonText,
    doneButton: {
      ...u.primaryButton,
      flex: 1,
    },
    doneButtonText: u.primaryButtonText,
  });
};
