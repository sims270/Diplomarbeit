import {
  assignOrder,
  createAccess,
  deleteAccess,
  extendAccess,
  type ExternalAccess,
  getAccesses,
  getAccessPassword,
  getAssignedAccessId,
  suggestExpiresOn,
  todayIso,
} from '@/app/services/externalDriverAccessService';
import { type AccessCredentials, AccessCredentialsModal } from '@/components/AccessCredentialsModal';
import { ExternalAccessChooser, NEW_ACCESS } from '@/components/ExternalAccessChooser';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert, showConfirm } from '@/lib/alert';
import { isoToGerman } from '@/lib/dateFormat';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

/** Die Schnellwahl beim Verlängern — bei Stammpartnern der Normalfall. */
export const EXTEND_DAY_OPTIONS = [3, 7, 14];

interface ExternalAccessPanelProps {
  orderId: string;
  /** "An Firma" des Auftrags — Vorschlag für den Namen eines neuen Zugangs */
  recipientCompany: string;
  /** Grundlage für den Vorschlag "gültig bis" */
  unloadingDate: string;
}

/**
 * Der Abschnitt "Fahrer-Zugang" im Fremdauftrag des Chefs
 * (app/chef/external-order/[id].tsx): welcher Zugang dem Auftrag
 * zugewiesen ist, Passwort erneut anzeigen, verlängern, Zuweisung aufheben,
 * Zugang löschen — oder, solange keiner zugewiesen ist, einen wählen bzw.
 * neu anlegen. Jede Aktion wirkt sofort, unabhängig vom Formular darüber.
 */
export function ExternalAccessPanel({
  orderId,
  recipientCompany,
  unloadingDate,
}: ExternalAccessPanelProps) {
  const styles = useThemedStyles(createStyles);
  const { c } = useAppTheme();
  const { t } = useTranslation();

  const [accesses, setAccesses] = useState<ExternalAccess[] | null>(null);
  const [assignedId, setAssignedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [credentials, setCredentials] = useState<AccessCredentials | null>(null);

  const [choice, setChoice] = useState('');
  const [label, setLabel] = useState<string | null>(null);
  const [expiresOn, setExpiresOn] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const [all, assigned] = await Promise.all([getAccesses(), getAssignedAccessId(orderId)]);
      setAccesses(all);
      setAssignedId(assigned);
    } catch {
      setLoadError(true);
      setAccesses([]);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const activeAccesses = (accesses ?? []).filter((access) => access.isActive);
  const assigned = (accesses ?? []).find((access) => access.userId === assignedId);
  const effectiveChoice = activeAccesses.length === 0 ? NEW_ACCESS : choice;
  const effectiveLabel = label ?? recipientCompany;
  const effectiveExpiresOn = expiresOn ?? suggestExpiresOn(unloadingDate);

  // Führt eine Aktion aus, lädt danach neu und meldet Fehler — damit nicht
  // jeder Button seine eigene Fehlerbehandlung braucht.
  const run = async (action: () => Promise<void>) => {
    setIsBusy(true);
    try {
      await action();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('externalAccess', 'actionFailed');
      showAlert(t('common', 'error'), message);
    } finally {
      setIsBusy(false);
      await load();
    }
  };

  const handleAssign = () => {
    if (!effectiveChoice) {
      showAlert(t('common', 'error'), t('externalAccess', 'alertChooseAccess'));
      return;
    }

    if (effectiveChoice !== NEW_ACCESS) {
      run(() => assignOrder(orderId, effectiveChoice));
      return;
    }

    const trimmedLabel = effectiveLabel.trim();
    if (!trimmedLabel) {
      showAlert(t('common', 'error'), t('externalAccess', 'alertLabelRequired'));
      return;
    }
    if (effectiveExpiresOn < todayIso()) {
      showAlert(t('common', 'error'), t('externalAccess', 'alertExpiresInPast'));
      return;
    }

    run(async () => {
      const created = await createAccess(trimmedLabel, effectiveExpiresOn);
      await assignOrder(orderId, created.userId);
      setChoice('');
      setLabel(null);
      setExpiresOn(null);
      setCredentials(created);
    });
  };

  const handleShowPassword = (access: ExternalAccess) =>
    run(async () => {
      const password = await getAccessPassword(access.userId);
      setCredentials({ username: access.username, password, expiresOn: access.expiresOn });
    });

  const handleExtend = (access: ExternalAccess, days: number) =>
    run(async () => {
      const newDate = await extendAccess(access, days);
      setShowExtend(false);
      showAlert(
        t('common', 'success'),
        t('externalAccess', 'extended').replace('{date}', isoToGerman(newDate))
      );
    });

  const handleUnassign = () => run(() => assignOrder(orderId, null));

  const handleDelete = (access: ExternalAccess) => {
    showConfirm(
      t('externalAccess', 'deleteConfirmTitle'),
      t('externalAccess', 'deleteConfirmMessage')
        .replace('{label}', access.label)
        .replace('{username}', access.username)
        .replace('{count}', String(access.orderCount)),
      () =>
        run(async () => {
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

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('externalAccess', 'sectionTitle')}</Text>

      {accesses === null ? (
        <ActivityIndicator style={styles.loading} color={c.tint} />
      ) : loadError ? (
        <Text style={styles.errorText}>{t('externalAccess', 'loadFailed')}</Text>
      ) : assigned ? (
        <>
          <Text style={styles.accessLabel}>{assigned.label}</Text>
          <Text style={styles.accessMeta}>
            {assigned.username}
            {' · '}
            {assigned.isActive
              ? `${t('externalAccess', 'validUntil')} ${isoToGerman(assigned.expiresOn)}`
              : `${t('externalAccess', 'expiredOn')} ${isoToGerman(assigned.expiresOn)}`}
            {' · '}
            {orderCountText(assigned.orderCount)}
          </Text>

          <View style={styles.buttonRow}>
            <FluidPressable
              style={styles.button}
              onPress={() => handleShowPassword(assigned)}
              disabled={isBusy}
            >
              <Text style={styles.buttonText}>{t('externalAccess', 'showPasswordButton')}</Text>
            </FluidPressable>
            <FluidPressable
              style={styles.button}
              onPress={() => setShowExtend((prev) => !prev)}
              disabled={isBusy}
            >
              <Text style={styles.buttonText}>{t('externalAccess', 'extendButton')}</Text>
            </FluidPressable>
            <FluidPressable style={styles.button} onPress={handleUnassign} disabled={isBusy}>
              <Text style={styles.buttonText}>{t('externalAccess', 'unassignButton')}</Text>
            </FluidPressable>
            <FluidPressable
              style={styles.dangerButton}
              onPress={() => handleDelete(assigned)}
              disabled={isBusy}
            >
              <Text style={styles.dangerButtonText}>{t('externalAccess', 'deleteButton')}</Text>
            </FluidPressable>
          </View>

          {showExtend ? (
            <View style={styles.buttonRow}>
              {EXTEND_DAY_OPTIONS.map((days) => (
                <FluidPressable
                  key={days}
                  style={styles.extendButton}
                  onPress={() => handleExtend(assigned, days)}
                  disabled={isBusy}
                >
                  <Text style={styles.extendButtonText}>
                    {t('externalAccess', 'extendDays').replace('{days}', String(days))}
                  </Text>
                </FluidPressable>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.hint}>{t('externalAccess', 'assignHint')}</Text>
          <ExternalAccessChooser
            accesses={activeAccesses}
            choice={effectiveChoice}
            onChoiceChange={setChoice}
            label={effectiveLabel}
            onLabelChange={setLabel}
            expiresOn={effectiveExpiresOn}
            onExpiresOnChange={setExpiresOn}
          />
          <FluidPressable
            style={[styles.assignButton, isBusy && styles.disabled]}
            onPress={handleAssign}
            disabled={isBusy}
          >
            {isBusy ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.assignButtonText}>
                {effectiveChoice === NEW_ACCESS
                  ? t('externalAccess', 'createAndAssignButton')
                  : t('externalAccess', 'assignButton')}
              </Text>
            )}
          </FluidPressable>
        </>
      )}

      <AccessCredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    section: {
      ...u.card,
      marginTop: Spacing.lg,
      marginBottom: Spacing.md,
    },
    sectionTitle: {
      ...Typography.title3,
      color: c.text,
      marginBottom: Spacing.sm,
    },
    loading: {
      marginVertical: Spacing.sm,
    },
    errorText: {
      ...Typography.subhead,
      color: c.danger,
    },
    hint: {
      ...u.hint,
      marginTop: 0,
      marginBottom: Spacing.sm,
    },
    accessLabel: {
      ...Typography.headline,
      color: c.text,
    },
    accessMeta: {
      ...Typography.subhead,
      color: c.textSecondary,
      marginTop: Spacing.xxs,
    },
    buttonRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
      marginTop: Spacing.md,
    },
    button: {
      minHeight: Layout.minTouch,
      justifyContent: 'center',
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.pill,
      backgroundColor: c.surfaceSecondary,
    },
    buttonText: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.text,
    },
    dangerButton: {
      minHeight: Layout.minTouch,
      justifyContent: 'center',
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.pill,
      backgroundColor: c.dangerSoft,
    },
    dangerButtonText: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.danger,
    },
    extendButton: u.smallButton,
    extendButtonText: u.smallButtonText,
    assignButton: {
      ...u.primaryButton,
      marginTop: Spacing.sm,
    },
    assignButtonText: u.primaryButtonText,
    disabled: u.disabled,
  });
};
