import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Colors } from '@/constants/theme';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert, showConfirm } from '@/lib/alert';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function EditDriverScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; username?: string }>();
  const driverId = params.id;

  const [username, setUsername] = useState(params.username ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername && !newPassword.trim()) {
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
