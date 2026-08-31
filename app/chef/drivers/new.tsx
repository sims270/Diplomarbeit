import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Colors } from '@/constants/theme';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert } from '@/lib/alert';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
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
  const [isCreating, setIsCreating] = useState(false);

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
