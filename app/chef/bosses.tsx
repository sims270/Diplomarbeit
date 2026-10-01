import { useAuth } from '@/app/context/AuthContext';
import {
  CANNOT_DELETE_LAST_BOSS,
  CANNOT_DELETE_SELF,
  createBoss,
  deleteBoss,
  getBosses,
  type Boss,
} from '@/app/services/bossService';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert, showConfirm } from '@/lib/alert';
import { isoToGerman } from '@/lib/dateFormat';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

/**
 * Chef-Konten anlegen und entfernen. Ein Chef-Konto sieht und darf alles —
 * deshalb eine eigene Seite mit Warnhinweis statt einer Rollenauswahl in
 * der Fahrerverwaltung, wo man sich leicht vergreift.
 */
export default function ChefBossesScreen() {
  const styles = useThemedStyles(createStyles);
  const { c, scheme } = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { isOfflineMode } = useAuth();

  const [bosses, setBosses] = useState<Boss[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);

    // Im Offline-Modus gibt es kein JWT, das die Edge Function akzeptieren
    // könnte — der Aufruf würde zwangsläufig scheitern.
    if (isOfflineMode) {
      setBosses([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      setBosses(await getBosses());
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isOfflineMode]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      load();
    }, [load])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    load();
  };

  const handleCreate = async () => {
    if (!username.trim() || !password) {
      showAlert(t('common', 'error'), t('chefBosses', 'fillFields'));
      return;
    }
    if (password.length < 8) {
      showAlert(t('common', 'error'), t('chefBosses', 'passwordTooShort'));
      return;
    }

    setBusy(true);
    try {
      await createBoss(username, password, name);
      setUsername('');
      setName('');
      setPassword('');
      showAlert(t('common', 'success'), t('chefBosses', 'created'));
      load();
    } catch (error) {
      showAlert(t('common', 'error'), error instanceof Error ? error.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (boss: Boss) => {
    showConfirm(
      t('chefBosses', 'deleteTitle'),
      t('chefBosses', 'deleteMessage').replace('{username}', boss.username),
      async () => {
        setBusy(true);
        try {
          await deleteBoss(boss.id);
          load();
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          showAlert(
            t('common', 'error'),
            message === CANNOT_DELETE_SELF
              ? t('chefBosses', 'cannotDeleteSelf')
              : message === CANNOT_DELETE_LAST_BOSS
                ? t('chefBosses', 'cannotDeleteLast')
                : message || undefined
          );
        } finally {
          setBusy(false);
        }
      },
      { destructive: true, confirmText: t('chefBosses', 'deleteButton') }
    );
  };

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('chefBosses', 'headerSubtitle')} code="CH" />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <FluidPressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/chef/profile'))}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>

        {/* Was ein zweites Chef-Konto bedeutet, bevor man eines anlegt. */}
        <View style={styles.warning}>
          <Text style={styles.warningTitle}>{t('chefBosses', 'warningTitle')}</Text>
          <Text style={styles.warningText}>{t('chefBosses', 'warningText')}</Text>
        </View>

        <Text style={styles.sectionTitle}>
          {t('chefBosses', 'listTitle')} ({bosses.length})
        </Text>

        {isOfflineMode ? (
          <Text style={styles.errorText}>{t('common', 'offlineModeHint')}</Text>
        ) : isLoading ? (
          <ActivityIndicator style={styles.loading} color={c.tint} />
        ) : loadError ? (
          <Text style={styles.errorText}>{t('chefBosses', 'loadFailed')}</Text>
        ) : (
          <FlatList
            scrollEnabled={false}
            data={bosses}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.bossCard}>
                <View style={styles.bossInfo}>
                  <View style={styles.bossTitleRow}>
                    <Text style={styles.bossUsername}>{item.username}</Text>
                    {item.isSelf && (
                      <View style={styles.selfBadge}>
                        <Text style={styles.selfBadgeText}>{t('chefBosses', 'selfBadge')}</Text>
                      </View>
                    )}
                  </View>
                  {!!item.name && <Text style={styles.bossName}>{item.name}</Text>}
                  <Text style={styles.bossMeta}>
                    {t('chefBosses', 'createdAt')} {isoToGerman(item.createdAt.slice(0, 10))}
                  </Text>
                </View>

                {/* Das eigene Konto lässt sich hier nicht löschen — sonst
                    säße man mit laufender Sitzung ohne Zugang da. Die Edge
                    Function lehnt es zusätzlich ab. */}
                {!item.isSelf && (
                  <FluidPressable
                    style={[styles.deleteButton, busy && styles.buttonDisabled]}
                    onPress={() => handleDelete(item)}
                    disabled={busy}
                  >
                    <Text style={styles.deleteButtonText}>{t('chefBosses', 'deleteButton')}</Text>
                  </FluidPressable>
                )}
              </View>
            )}
          />
        )}

        {!isOfflineMode && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('chefBosses', 'addTitle')}</Text>

            <Text style={styles.fieldLabel}>{t('chefBosses', 'usernameLabel')}</Text>
            <TextInput
              placeholderTextColor={c.placeholder}
              keyboardAppearance={scheme}
              style={styles.input}
              placeholder={t('chefBosses', 'usernamePlaceholder')}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              editable={!busy}
            />

            <Text style={styles.fieldLabel}>{t('chefBosses', 'nameLabel')}</Text>
            <TextInput
              placeholderTextColor={c.placeholder}
              keyboardAppearance={scheme}
              style={styles.input}
              placeholder={t('chefBosses', 'namePlaceholder')}
              value={name}
              onChangeText={setName}
              editable={!busy}
            />

            <Text style={styles.fieldLabel}>{t('chefBosses', 'passwordLabel')}</Text>
            <TextInput
              placeholderTextColor={c.placeholder}
              keyboardAppearance={scheme}
              style={styles.input}
              placeholder={t('chefBosses', 'passwordPlaceholder')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!busy}
            />

            <FluidPressable
              style={[styles.createButton, busy && styles.buttonDisabled]}
              onPress={handleCreate}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.createButtonText}>{t('chefBosses', 'createButton')}</Text>
              )}
            </FluidPressable>
          </View>
        )}
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
    contentInner: u.formColumn,
    backButton: u.backButton,
    backButtonText: u.backButtonText,
    warning: {
      backgroundColor: c.tintSoft,
      borderRadius: Radius.md,
      padding: Spacing.md,
      marginBottom: Spacing.lg,
    },
    warningTitle: {
      ...Typography.headline,
      color: c.tint,
      marginBottom: Spacing.xxs,
    },
    warningText: {
      ...Typography.subhead,
      color: c.text,
    },
    sectionTitle: {
      ...Typography.title3,
      color: c.text,
      marginBottom: Spacing.sm,
    },
    loading: {
      marginVertical: Spacing.lg,
    },
    errorText: {
      ...Typography.subhead,
      color: c.textSecondary,
      marginBottom: Spacing.md,
    },
    bossCard: {
      ...u.card,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    bossInfo: {
      flex: 1,
    },
    bossTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    bossUsername: {
      ...Typography.headline,
      color: c.text,
    },
    selfBadge: {
      ...u.badge,
      backgroundColor: c.surfaceTertiary,
    },
    selfBadgeText: {
      ...u.badgeText,
      color: c.textSecondary,
    },
    bossName: {
      ...Typography.subhead,
      color: c.textSecondary,
      marginTop: 2,
    },
    bossMeta: {
      ...Typography.footnote,
      color: c.textTertiary,
      marginTop: 2,
    },
    deleteButton: {
      ...u.tintedButton,
      minHeight: 44,
      paddingHorizontal: Spacing.md,
    },
    deleteButtonText: {
      ...u.tintedButtonText,
      ...Typography.subhead,
      fontWeight: '600',
    },
    card: {
      ...u.card,
      marginTop: Spacing.lg,
    },
    cardTitle: {
      ...Typography.title3,
      color: c.text,
      marginBottom: Spacing.xs,
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
    createButton: {
      ...u.primaryButton,
      marginTop: Spacing.sm,
    },
    createButtonText: u.primaryButtonText,
    buttonDisabled: u.disabled,
  });
};
