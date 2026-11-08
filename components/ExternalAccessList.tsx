import {
  checkNewAccess,
  createAccess,
  deleteAccess,
  extendAccess,
  type ExternalAccess,
  getAccesses,
  renameAccess,
  resetAccessPassword,
  suggestExpiresOn,
  suggestUsername,
  todayIso,
} from '@/app/services/externalDriverAccessService';
import { type AccessCredentials, AccessCredentialsModal } from '@/components/AccessCredentialsModal';
import { ExternalAccessChooser, NEW_ACCESS } from '@/components/ExternalAccessChooser';
import { EXTEND_DAY_OPTIONS } from '@/components/ExternalAccessPanel';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { shadow, Spacing, Typography } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert, showConfirm } from '@/lib/alert';
import { isoToGerman } from '@/lib/dateFormat';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

/**
 * Alle Zugänge fremder Fahrer, in der Fahrerverwaltung des Chefs
 * (app/chef/drivers/index.tsx, Reiter "Fremdfahrer"). Hier lassen sie sich
 * unabhängig von einem Auftrag anlegen und pflegen: Benutzername ändern,
 * neues Passwort, verlängern, löschen. Zuweisen geht weiterhin beim
 * Fremdauftrag.
 */
export function ExternalAccessList() {
  const styles = useThemedStyles(createStyles);
  const { c, scheme, columns } = useAppTheme();
  const { t } = useTranslation();

  const [accesses, setAccesses] = useState<ExternalAccess[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyAccessId, setBusyAccessId] = useState<string | null>(null);
  const [extendAccessId, setExtendAccessId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<AccessCredentials | null>(null);

  // Neuer Zugang. username null = folgt dem Namen, bis der Chef selbst tippt.
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateBusy, setIsCreateBusy] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newUsername, setNewUsername] = useState<string | null>(null);
  const [newExpiresOn, setNewExpiresOn] = useState(() => suggestExpiresOn(''));

  // Benutzername ändern: welcher Zugang gerade bearbeitet wird, und der Entwurf.
  const [renameAccessId, setRenameAccessId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      setAccesses(await getAccesses());
    } catch {
      setLoadError(true);
      setAccesses([]);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Neu laden, wenn man z. B. von einem Fremdauftrag zurückkommt, bei dem
  // gerade ein Zugang angelegt wurde.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const allAccesses = accesses ?? [];
  const effectiveNewUsername = newUsername ?? suggestUsername(newLabel);

  const usernameProblemText = (problem: 'invalid' | 'taken', username: string) =>
    problem === 'taken'
      ? t('externalAccess', 'usernameTaken').replace('{username}', username.trim().toLowerCase())
      : t('externalAccess', 'usernameInvalid');

  const resetCreateForm = () => {
    setIsCreating(false);
    setNewLabel('');
    setNewUsername(null);
    setNewExpiresOn(suggestExpiresOn(''));
  };

  const handleCreate = async () => {
    const label = newLabel.trim();
    const username = effectiveNewUsername.trim();
    if (!label) {
      showAlert(t('common', 'error'), t('externalAccess', 'alertLabelRequired'));
      return;
    }
    const { usernameProblem } = checkNewAccess(label, username, allAccesses);
    if (usernameProblem) {
      showAlert(t('common', 'error'), usernameProblemText(usernameProblem, username));
      return;
    }
    if (!newExpiresOn) {
      showAlert(t('common', 'error'), t('externalAccess', 'alertExpiresRequired'));
      return;
    }
    if (newExpiresOn < todayIso()) {
      showAlert(t('common', 'error'), t('externalAccess', 'alertExpiresInPast'));
      return;
    }

    setIsCreateBusy(true);
    try {
      const created = await createAccess(label, username, newExpiresOn);
      resetCreateForm();
      setCredentials(created);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('externalAccess', 'actionFailed');
      showAlert(t('common', 'error'), message);
    } finally {
      setIsCreateBusy(false);
      await load();
    }
  };

  const runAccessAction = async (userId: string, action: () => Promise<void>) => {
    setBusyAccessId(userId);
    try {
      await action();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('externalAccess', 'actionFailed');
      showAlert(t('common', 'error'), message);
    } finally {
      setBusyAccessId(null);
      await load();
    }
  };

  const startRename = (access: ExternalAccess) => {
    setRenameAccessId((prev) => (prev === access.userId ? null : access.userId));
    setRenameDraft(access.username);
  };

  const handleRename = (access: ExternalAccess) => {
    const username = renameDraft.trim().toLowerCase();
    if (username === access.username.toLowerCase()) {
      setRenameAccessId(null);
      return;
    }
    const { usernameProblem } = checkNewAccess(access.label, username, allAccesses, access.userId);
    if (usernameProblem) {
      showAlert(t('common', 'error'), usernameProblemText(usernameProblem, username));
      return;
    }
    runAccessAction(access.userId, async () => {
      await renameAccess(access.userId, username);
      setRenameAccessId(null);
      showAlert(
        t('common', 'success'),
        t('externalAccess', 'renamed').replace('{username}', username)
      );
    });
  };

  const handleResetPassword = (access: ExternalAccess) => {
    showConfirm(
      t('externalAccess', 'resetPasswordConfirmTitle'),
      t('externalAccess', 'resetPasswordConfirmMessage')
        .replace('{label}', access.label)
        .replace('{username}', access.username),
      () =>
        runAccessAction(access.userId, async () => {
          const password = await resetAccessPassword(access.userId);
          setCredentials({ username: access.username, password, expiresOn: access.expiresOn });
        }),
      {
        confirmText: t('externalAccess', 'resetPasswordConfirmButton'),
        cancelText: t('common', 'cancel'),
      }
    );
  };

  const handleExtend = (access: ExternalAccess, days: number) =>
    runAccessAction(access.userId, async () => {
      const newDate = await extendAccess(access, days);
      setExtendAccessId(null);
      showAlert(
        t('common', 'success'),
        t('externalAccess', 'extended').replace('{date}', isoToGerman(newDate))
      );
    });

  const handleDelete = (access: ExternalAccess) => {
    showConfirm(
      t('externalAccess', 'deleteConfirmTitle'),
      t('externalAccess', 'deleteConfirmMessage')
        .replace('{label}', access.label)
        .replace('{username}', access.username)
        .replace('{count}', String(access.orderCount)),
      () =>
        runAccessAction(access.userId, async () => {
          await deleteAccess(access.userId);
          showAlert(t('common', 'success'), t('externalAccess', 'deleted'));
        }),
      {
        confirmText: t('externalAccess', 'deleteConfirmButton'),
        cancelText: t('common', 'cancel'),
        destructive: true,
      }
    );
  };

  const orderCountText = (count: number) =>
    count === 1
      ? t('externalAccess', 'orderCountOne')
      : `${count} ${t('externalAccess', 'orderCountMany')}`;

  if (accesses === null) {
    return <ActivityIndicator style={styles.loading} color={c.tint} />;
  }

  const listHeader = (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {t('driversList', 'tabExternal')} ({accesses.length})
        </Text>
        {!isCreating && (
          <FluidPressable style={styles.addButton} onPress={() => setIsCreating(true)}>
            <Text style={styles.addButtonText}>{t('externalAccess', 'createButton')}</Text>
          </FluidPressable>
        )}
      </View>
      <Text style={styles.hint}>{t('externalAccess', 'listHint')}</Text>

      {isCreating ? (
        <View style={styles.createCard}>
          <Text style={styles.createTitle}>{t('externalAccess', 'createTitle')}</Text>
          {/* Ohne Auswahlliste: Mit leerem accesses zeigt die Komponente
              nur die Felder für einen neuen Zugang. */}
          <ExternalAccessChooser
            accesses={[]}
            choice={NEW_ACCESS}
            onChoiceChange={() => {}}
            existingAccesses={allAccesses}
            label={newLabel}
            onLabelChange={setNewLabel}
            username={effectiveNewUsername}
            onUsernameChange={setNewUsername}
            expiresOn={newExpiresOn}
            onExpiresOnChange={setNewExpiresOn}
          />
          <View style={styles.buttons}>
            <FluidPressable
              style={[styles.primaryButton, isCreateBusy && styles.disabled]}
              onPress={handleCreate}
              disabled={isCreateBusy}
            >
              {isCreateBusy ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.primaryButtonText}>{t('externalAccess', 'createSubmit')}</Text>
              )}
            </FluidPressable>
            <FluidPressable style={styles.button} onPress={resetCreateForm} disabled={isCreateBusy}>
              <Text style={styles.buttonText}>{t('common', 'cancel')}</Text>
            </FluidPressable>
          </View>
        </View>
      ) : null}

      {loadError ? (
        <Text style={styles.errorText}>{t('externalAccess', 'loadFailed')}</Text>
      ) : null}
    </View>
  );

  return (
    <>
      <FlatList
        // Wie die Liste der eigenen Fahrer; key erzwingt Neuaufbau beim Spaltenwechsel
        key={`grid-${columns}`}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
        data={accesses}
        keyExtractor={(item) => item.userId}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          loadError || isCreating ? null : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>{t('externalAccess', 'listEmpty')}</Text>
              <Text style={styles.emptyStateSubtext}>{t('externalAccess', 'listEmptySub')}</Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              load();
            }}
          />
        }
        renderItem={({ item }) => {
          const isBusy = busyAccessId === item.userId;
          const isRenaming = renameAccessId === item.userId;
          const renameCheck = isRenaming
            ? checkNewAccess(item.label, renameDraft, allAccesses, item.userId)
            : null;
          return (
            <View style={styles.card}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.meta}>
                {item.username}
                {' · '}
                <Text style={item.isActive ? undefined : styles.expired}>
                  {item.isActive
                    ? `${t('externalAccess', 'validUntil')} ${isoToGerman(item.expiresOn)}`
                    : `${t('externalAccess', 'expiredOn')} ${isoToGerman(item.expiresOn)}`}
                </Text>
                {' · '}
                {orderCountText(item.orderCount)}
              </Text>

              {isRenaming ? (
                <View style={styles.renameBox}>
                  <TextInput
                    placeholderTextColor={c.placeholder}
                    keyboardAppearance={scheme}
                    style={styles.input}
                    placeholder={t('externalAccess', 'usernamePlaceholder')}
                    value={renameDraft}
                    onChangeText={setRenameDraft}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                  />
                  {renameDraft.trim() && renameCheck?.usernameProblem ? (
                    <Text style={styles.problem}>
                      {usernameProblemText(renameCheck.usernameProblem, renameDraft)}
                    </Text>
                  ) : null}
                  <View style={styles.buttons}>
                    <FluidPressable
                      style={styles.button}
                      onPress={() => handleRename(item)}
                      disabled={isBusy}
                    >
                      <Text style={styles.buttonText}>{t('externalAccess', 'renameSave')}</Text>
                    </FluidPressable>
                    <FluidPressable
                      style={styles.button}
                      onPress={() => setRenameAccessId(null)}
                      disabled={isBusy}
                    >
                      <Text style={styles.buttonText}>{t('common', 'cancel')}</Text>
                    </FluidPressable>
                  </View>
                </View>
              ) : null}

              <View style={styles.buttons}>
                <FluidPressable
                  style={styles.button}
                  onPress={() => startRename(item)}
                  disabled={isBusy}
                >
                  <Text style={styles.buttonText}>{t('externalAccess', 'renameButton')}</Text>
                </FluidPressable>
                <FluidPressable
                  style={styles.button}
                  onPress={() => handleResetPassword(item)}
                  disabled={isBusy}
                >
                  <Text style={styles.buttonText}>
                    {t('externalAccess', 'resetPasswordButton')}
                  </Text>
                </FluidPressable>
                <FluidPressable
                  style={styles.button}
                  onPress={() =>
                    setExtendAccessId((prev) => (prev === item.userId ? null : item.userId))
                  }
                  disabled={isBusy}
                >
                  <Text style={styles.buttonText}>{t('externalAccess', 'extendButton')}</Text>
                </FluidPressable>
                <FluidPressable
                  style={styles.deleteButton}
                  onPress={() => handleDelete(item)}
                  disabled={isBusy}
                >
                  <Text style={styles.deleteButtonText}>
                    {t('externalAccess', 'deleteConfirmButton')}
                  </Text>
                </FluidPressable>
                {isBusy && <ActivityIndicator color={c.tint} />}
              </View>

              {extendAccessId === item.userId ? (
                <View style={styles.buttons}>
                  {EXTEND_DAY_OPTIONS.map((days) => (
                    <FluidPressable
                      key={days}
                      style={styles.button}
                      onPress={() => handleExtend(item, days)}
                      disabled={isBusy}
                    >
                      <Text style={styles.buttonText}>
                        {t('externalAccess', 'extendDays').replace('{days}', String(days))}
                      </Text>
                    </FluidPressable>
                  ))}
                </View>
              ) : null}
            </View>
          );
        }}
      />

      <AccessCredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />
    </>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c, scheme } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    loading: {
      marginTop: Spacing.xl,
    },
    sectionHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    sectionTitle: {
      ...Typography.title2,
      color: c.text,
      flexShrink: 1,
    },
    addButton: u.smallButton,
    addButtonText: u.smallButtonText,
    hint: {
      ...u.hint,
      marginTop: 0,
      marginBottom: Spacing.md,
    },
    createCard: {
      ...u.card,
      marginBottom: Spacing.md,
      ...shadow(1, scheme),
    },
    createTitle: {
      ...Typography.headline,
      color: c.text,
      marginBottom: Spacing.xs,
    },
    primaryButton: {
      ...u.primaryButton,
      flexGrow: 1,
    },
    primaryButtonText: u.primaryButtonText,
    disabled: u.disabled,
    errorText: u.errorText,
    emptyState: u.emptyState,
    emptyStateText: u.emptyStateText,
    emptyStateSubtext: u.emptyStateSubtext,
    gridRow: u.gridRow,
    card: {
      ...u.gridItem,
      ...u.card,
      marginBottom: Spacing.xs,
      ...shadow(1, scheme),
    },
    label: {
      ...Typography.headline,
      color: c.text,
    },
    meta: {
      ...Typography.subhead,
      color: c.textSecondary,
      marginTop: Spacing.xxs,
    },
    expired: {
      color: c.danger,
    },
    renameBox: {
      marginTop: Spacing.sm,
    },
    input: u.input,
    problem: {
      ...u.hint,
      color: c.danger,
    },
    buttons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.sm,
    },
    button: u.smallButton,
    buttonText: u.smallButtonText,
    deleteButton: {
      ...u.smallButton,
      backgroundColor: c.dangerSoft,
    },
    deleteButtonText: {
      ...u.smallButtonText,
      color: c.danger,
    },
  });
};
