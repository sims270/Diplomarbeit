import { useAuth } from '@/app/context/AuthContext';
import { changeOwnPassword, updateOwnName } from '@/app/services/accountService';
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
 * Eigenes Konto des Chefs: Anzeigename und Passwort. Benutzername und Rolle
 * stehen nur zur Ansicht da — der Benutzername steckt in der Anmeldeadresse
 * des Kontos, die Rolle vergibt die Datenbank.
 */
export default function ChefAccountScreen() {
  const styles = useThemedStyles(createStyles);
  const { c, scheme } = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { user, isOfflineMode } = useAuth();

  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [busy, setBusy] = useState<'name' | 'password' | null>(null);

  // Vorbelegen, sobald das Konto geladen ist — und nach einer Änderung,
  // weil der Name dann aus der aufgefrischten Sitzung kommt.
  useEffect(() => {
    setName(user?.name ?? '');
  }, [user?.name]);

  const handleSaveName = async () => {
    if (!name.trim()) {
      showAlert(t('common', 'error'), t('chefProfile', 'nameEmpty'));
      return;
    }

    setBusy('name');
    try {
      await updateOwnName(name);
      showAlert(t('common', 'success'), t('chefProfile', 'nameSaved'));
    } catch (error) {
      showAlert(t('common', 'error'), error instanceof Error ? error.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      showAlert(t('common', 'error'), t('chefProfile', 'passwordTooShort'));
      return;
    }
    if (newPassword !== repeatPassword) {
      showAlert(t('common', 'error'), t('chefProfile', 'passwordMismatch'));
      return;
    }

    setBusy('password');
    try {
      await changeOwnPassword(user?.username ?? '', currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
      showAlert(t('common', 'success'), t('chefProfile', 'passwordChanged'));
    } catch (error) {
      const wrong = error instanceof Error && error.message === 'WRONG_CURRENT_PASSWORD';
      showAlert(
        t('common', 'error'),
        wrong
          ? t('chefProfile', 'passwordWrongCurrent')
          : error instanceof Error
            ? error.message
            : undefined
      );
    } finally {
      setBusy(null);
    }
  };

  const isBusy = busy !== null;

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('chefAccount', 'headerSubtitle')} code="CH" />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <FluidPressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/chef/profile'))}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('chefAccount', 'title')}</Text>
          <Text style={styles.sectionDescription}>{t('chefProfile', 'accountDesc')}</Text>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('chefProfile', 'usernameLabel')}</Text>
            <Text style={styles.rowValue}>{user?.username}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('chefProfile', 'roleLabel')}</Text>
            <Text style={styles.rowValue}>{t('chefProfile', 'roleValue')}</Text>
          </View>

          {/* Ohne gültiges Token lehnt Supabase jede Änderung ab — dann gar
              nicht erst Felder anbieten, die nicht funktionieren. */}
          {isOfflineMode ? (
            <Text style={styles.offlineHint}>{t('chefProfile', 'offlineHint')}</Text>
          ) : (
            <>
              <Text style={styles.fieldLabel}>{t('chefProfile', 'nameLabel')}</Text>
              <TextInput
                placeholderTextColor={c.placeholder}
                keyboardAppearance={scheme}
                style={styles.input}
                placeholder={t('chefProfile', 'namePlaceholder')}
                value={name}
                onChangeText={setName}
                editable={!isBusy}
              />
              <FluidPressable
                style={[styles.saveButton, isBusy && styles.buttonDisabled]}
                onPress={handleSaveName}
                disabled={isBusy}
              >
                {busy === 'name' ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>{t('chefProfile', 'saveNameButton')}</Text>
                )}
              </FluidPressable>

              <Text style={styles.subSectionTitle}>{t('chefProfile', 'passwordSection')}</Text>

              <Text style={styles.fieldLabel}>{t('chefProfile', 'currentPasswordLabel')}</Text>
              <TextInput
                placeholderTextColor={c.placeholder}
                keyboardAppearance={scheme}
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                editable={!isBusy}
              />

              <Text style={styles.fieldLabel}>{t('chefProfile', 'newPasswordLabel')}</Text>
              <TextInput
                placeholderTextColor={c.placeholder}
                keyboardAppearance={scheme}
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                editable={!isBusy}
              />

              <Text style={styles.fieldLabel}>{t('chefProfile', 'repeatPasswordLabel')}</Text>
              <TextInput
                placeholderTextColor={c.placeholder}
                keyboardAppearance={scheme}
                style={styles.input}
                value={repeatPassword}
                onChangeText={setRepeatPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                editable={!isBusy}
              />

              <FluidPressable
                style={[styles.saveButton, isBusy && styles.buttonDisabled]}
                onPress={handleChangePassword}
                disabled={isBusy}
              >
                {busy === 'password' ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {t('chefProfile', 'changePasswordButton')}
                  </Text>
                )}
              </FluidPressable>
            </>
          )}
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
      color: c.text,
      marginBottom: Spacing.xxs,
    },
    sectionDescription: {
      ...Typography.subhead,
      color: c.textSecondary,
      marginBottom: Spacing.md,
    },
    row: {
      minHeight: 44,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    rowLabel: {
      ...Typography.callout,
      color: c.textSecondary,
    },
    rowValue: {
      ...Typography.callout,
      fontWeight: '600',
      color: c.text,
      flexShrink: 1,
      textAlign: 'right',
    },
    fieldLabel: {
      ...Typography.caption1,
      fontWeight: '600',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginTop: Spacing.sm,
      marginBottom: Spacing.xs - 2,
    },
    input: {
      ...u.input,
      backgroundColor: c.surfaceSecondary,
      borderColor: 'transparent',
      marginBottom: Spacing.xs,
    },
    subSectionTitle: {
      ...Typography.headline,
      color: c.text,
      marginTop: Spacing.lg,
    },
    saveButton: {
      ...u.primaryButton,
      marginTop: Spacing.sm,
    },
    saveButtonText: u.primaryButtonText,
    buttonDisabled: u.disabled,
    offlineHint: {
      ...u.hint,
      marginTop: Spacing.sm,
    },
  });
};
