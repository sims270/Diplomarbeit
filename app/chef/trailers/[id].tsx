import {
  getPickerlStatus,
  nextPickerlDueDate,
  type PickerlStatus,
} from '@/app/services/licensePlateService';
import {
  addTrailerPermit,
  deleteTrailer,
  deleteTrailerPermit,
  getTrailerPermits,
  markTrailerPickerlDone,
  nextPermitValidUntil,
  PERMIT_VALIDITY_YEARS,
  renewTrailerPermit,
  saveTrailer,
  setPermitValidityYears,
  type TrailerPermit,
} from '@/app/services/trailerService';
import { DateField } from '@/components/DateField';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert, showConfirm } from '@/lib/alert';
import { isoToGerman } from '@/lib/dateFormat';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

/**
 * Einen Auflieger bearbeiten: Kennzeichen, Beschreibung und Pickerl. Das
 * Pickerl funktioniert wie beim LKW (app/chef/vehicles/[id].tsx).
 */
export default function EditTrailerScreen() {
  const styles = useThemedStyles(createStyles);
  const { c, scheme } = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    id: string;
    plate?: string;
    description?: string;
    pickerlDueDate?: string;
  }>();

  const [plate, setPlate] = useState(params.plate ?? '');
  const [description, setDescription] = useState(params.description ?? '');
  const [pickerlDueDate, setPickerlDueDate] = useState(params.pickerlDueDate ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isPickerlSaving, setIsPickerlSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Genehmigungen werden sofort gespeichert, nicht erst mit "Speichern" —
  // jede ist eine eigene Zeile in trailer_permits.
  const [permits, setPermits] = useState<TrailerPermit[]>([]);
  const [permitsError, setPermitsError] = useState<string | null>(null);
  const [newPermitName, setNewPermitName] = useState('');
  const [newPermitDate, setNewPermitDate] = useState('');
  const [newPermitYears, setNewPermitYears] = useState(1);
  const [busyPermitId, setBusyPermitId] = useState<string | null>(null);
  const [isAddingPermit, setIsAddingPermit] = useState(false);

  const busy = isSaving || isPickerlSaving || isDeleting;
  const label = params.plate ?? '';
  const pickerl = getPickerlStatus(pickerlDueDate || null);

  const loadPermits = useCallback(async () => {
    setPermitsError(null);
    try {
      setPermits(await getTrailerPermits(params.id));
    } catch (error) {
      setPermitsError(error instanceof Error ? error.message : '');
    }
  }, [params.id]);

  useEffect(() => {
    loadPermits();
  }, [loadPermits]);

  /** "noch 27 Tage" / "heute fällig" / "überfällig seit 4 Tagen". */
  const remainingText = (status: PickerlStatus) =>
    status.isOverdue
      ? t('vehicles', 'pickerlOverdue').replace('{days}', String(-status.daysRemaining))
      : status.daysRemaining === 0
        ? t('vehicles', 'pickerlDueToday')
        : t('vehicles', 'pickerlDaysLeft').replace('{days}', String(status.daysRemaining));

  const handleAddPermit = async () => {
    if (!newPermitName.trim()) {
      showAlert(t('common', 'error'), t('trailers', 'permitAlertEmptyName'));
      return;
    }
    if (!newPermitDate) {
      showAlert(t('common', 'error'), t('trailers', 'permitAlertEmptyDate'));
      return;
    }

    setIsAddingPermit(true);
    try {
      await addTrailerPermit(params.id, {
        name: newPermitName,
        validUntil: newPermitDate,
        validityYears: newPermitYears,
      });
      setNewPermitName('');
      setNewPermitDate('');
      setNewPermitYears(1);
      await loadPermits();
    } catch (error) {
      showAlert(
        t('common', 'error'),
        error instanceof Error ? error.message : t('trailers', 'permitAlertAddFailed')
      );
    } finally {
      setIsAddingPermit(false);
    }
  };

  const runPermitAction = async (permitId: string, action: () => Promise<void>) => {
    setBusyPermitId(permitId);
    try {
      await action();
    } catch (error) {
      showAlert(
        t('common', 'error'),
        error instanceof Error ? error.message : t('trailers', 'permitAlertFailed')
      );
    } finally {
      setBusyPermitId(null);
      await loadPermits();
    }
  };

  const handleRenewPermit = (permit: TrailerPermit) =>
    showConfirm(
      t('trailers', 'permitRenewConfirmTitle'),
      `"${permit.name}" — ${t('trailers', 'permitRenewConfirmMessage')} ${isoToGerman(
        nextPermitValidUntil(permit)
      )}.`,
      () =>
        runPermitAction(permit.id, async () => {
          await renewTrailerPermit(permit);
        }),
      {
        confirmText: t('trailers', 'permitRenewConfirmConfirm'),
        cancelText: t('common', 'cancel'),
      }
    );

  /** "1 Jahr" / "3 Jahre" */
  const yearsText = (years: number) =>
    `${years} ${t('trailers', years === 1 ? 'permitYear' : 'permitYears')}`;

  /** Auswahl der Gültigkeitsdauer — beim Hinzufügen und je Genehmigung. */
  const renderYearChips = (selected: number, onSelect: (years: number) => void, disabled: boolean) => (
    <View style={styles.chipRow}>
      {PERMIT_VALIDITY_YEARS.map((years) => {
        const active = years === selected;
        return (
          <FluidPressable
            key={years}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => !active && onSelect(years)}
            disabled={disabled}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {yearsText(years)}
            </Text>
          </FluidPressable>
        );
      })}
    </View>
  );

  const handleDeletePermit = (permit: TrailerPermit) =>
    showConfirm(
      t('trailers', 'permitDeleteConfirmTitle'),
      `"${permit.name}" ${t('trailers', 'permitDeleteConfirmMessage')}`,
      () => runPermitAction(permit.id, () => deleteTrailerPermit(permit.id)),
      {
        confirmText: t('trailers', 'deleteConfirmConfirm'),
        cancelText: t('common', 'cancel'),
        destructive: true,
      }
    );

  const handleSave = async () => {
    if (!plate.trim()) {
      showAlert(t('common', 'error'), t('trailers', 'alertEmptyPlate'));
      return;
    }

    setIsSaving(true);
    try {
      await saveTrailer(params.id, {
        plate,
        description,
        pickerlDueDate: pickerlDueDate || null,
      });
      showAlert(t('common', 'success'), `"${plate.trim().toUpperCase()}" ${t('trailers', 'alertSaved')}`);
      router.back();
    } catch (error) {
      showAlert(
        t('common', 'error'),
        error instanceof Error ? error.message : t('trailers', 'alertSaveFailed')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePickerlDone = () => {
    if (!pickerlDueDate) return;
    showConfirm(
      t('vehicles', 'pickerlDoneConfirmTitle'),
      `"${label}" — ${t('vehicles', 'pickerlDoneConfirmMessage')} ${isoToGerman(
        nextPickerlDueDate(pickerlDueDate)
      )}.`,
      async () => {
        setIsPickerlSaving(true);
        try {
          const next = await markTrailerPickerlDone(params.id, pickerlDueDate);
          showAlert(
            t('common', 'success'),
            `"${label}": ${t('vehicles', 'alertPickerlDone')} ${isoToGerman(next)}`
          );
          router.back();
        } catch (error) {
          showAlert(
            t('common', 'error'),
            error instanceof Error ? error.message : t('vehicles', 'alertPickerlFailed')
          );
        } finally {
          setIsPickerlSaving(false);
        }
      },
      {
        confirmText: t('vehicles', 'pickerlDoneConfirmConfirm'),
        cancelText: t('common', 'cancel'),
      }
    );
  };

  const handleDelete = () =>
    showConfirm(
      t('trailers', 'deleteConfirmTitle'),
      `"${label}" ${t('trailers', 'deleteConfirmMessage')}`,
      async () => {
        setIsDeleting(true);
        try {
          await deleteTrailer(params.id);
          showAlert(t('common', 'success'), `"${label}" ${t('trailers', 'alertDeleted')}`);
          router.back();
        } catch (error) {
          showAlert(
            t('common', 'error'),
            error instanceof Error ? error.message : t('trailers', 'alertDeleteFailed')
          );
        } finally {
          setIsDeleting(false);
        }
      },
      {
        confirmText: t('trailers', 'deleteConfirmConfirm'),
        cancelText: t('common', 'cancel'),
        destructive: true,
      }
    );

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('trailers', 'editHeaderSubtitle')} code="CH" />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <FluidPressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('trailers', 'editTitle')}</Text>

          <Text style={styles.label}>{t('vehicles', 'plateLabel')}</Text>
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            value={plate}
            onChangeText={setPlate}
            placeholder={t('trailers', 'addPlaceholder')}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
          />

          <Text style={styles.label}>{t('trailers', 'descriptionLabel')}</Text>
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder={t('trailers', 'descriptionPlaceholder')}
            editable={!busy}
          />

          <Text style={styles.sectionSubTitle}>{t('vehicles', 'pickerlSection')}</Text>

          <Text style={styles.label}>{t('vehicles', 'pickerlDueLabel')}</Text>
          <DateField
            value={pickerlDueDate}
            onChange={setPickerlDueDate}
            placeholder={t('vehicles', 'pickerlDuePlaceholder')}
          />

          {pickerl !== null && (
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>
                {`${t('vehicles', 'pickerlRemindFrom')} ${isoToGerman(pickerl.remindFrom)}`}
              </Text>
              <Text style={[styles.statusRemaining, pickerl.isDue && styles.statusDue]}>
                {remainingText(pickerl)}
              </Text>
              <FluidPressable onPress={() => setPickerlDueDate('')} disabled={busy}>
                <Text style={styles.clearLink}>{t('vehicles', 'pickerlClear')}</Text>
              </FluidPressable>
            </View>
          )}

          <Text style={styles.hint}>{t('vehicles', 'pickerlHint')}</Text>

          <FluidPressable
            style={[styles.saveButton, busy && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={busy}
          >
            {isSaving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.saveButtonText}>{t('vehicles', 'saveButton')}</Text>
            )}
          </FluidPressable>
        </View>

        <View style={[styles.card, styles.cardSpaced]}>
          <Text style={styles.sectionTitle}>{t('trailers', 'permitsSection')}</Text>
          <Text style={styles.hint}>{t('trailers', 'permitsHint')}</Text>

          {permitsError !== null ? (
            <Text style={styles.statusRemaining}>
              {t('trailers', 'permitsLoadFailed')}
              {permitsError ? ` (${permitsError})` : ''}
            </Text>
          ) : permits.length === 0 ? (
            <Text style={styles.statusRemaining}>{t('trailers', 'permitsEmpty')}</Text>
          ) : (
            permits.map((permit) => {
              const status = getPickerlStatus(permit.validUntil);
              const isBusy = busyPermitId === permit.id;
              return (
                <View key={permit.id} style={styles.statusBox}>
                  <Text style={styles.statusText}>{permit.name}</Text>
                  <Text style={styles.statusRemaining}>
                    {`${t('trailers', 'permitValidUntil')} ${isoToGerman(permit.validUntil)}`}
                  </Text>
                  {status && (
                    <Text style={[styles.statusRemaining, status.isDue && styles.statusDue]}>
                      {remainingText(status)}
                    </Text>
                  )}
                  <Text style={[styles.label, styles.chipLabel]}>
                    {t('trailers', 'permitValidityLabel')}
                  </Text>
                  {renderYearChips(
                    permit.validityYears,
                    (years) =>
                      runPermitAction(permit.id, () => setPermitValidityYears(permit.id, years)),
                    busyPermitId !== null
                  )}
                  <View style={styles.permitActions}>
                    {isBusy ? (
                      <ActivityIndicator color={c.tint} />
                    ) : (
                      <>
                        <FluidPressable
                          onPress={() => handleRenewPermit(permit)}
                          disabled={busyPermitId !== null}
                        >
                          <Text style={styles.clearLink}>{t('trailers', 'permitRenewButton')}</Text>
                        </FluidPressable>
                        <FluidPressable
                          onPress={() => handleDeletePermit(permit)}
                          disabled={busyPermitId !== null}
                        >
                          <Text style={[styles.clearLink, styles.dangerLink]}>
                            {t('trailers', 'permitDeleteButton')}
                          </Text>
                        </FluidPressable>
                      </>
                    )}
                  </View>
                </View>
              );
            })
          )}

          <Text style={[styles.label, styles.permitAddLabel]}>{t('trailers', 'permitAddTitle')}</Text>
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            value={newPermitName}
            onChangeText={setNewPermitName}
            placeholder={t('trailers', 'permitNamePlaceholder')}
            editable={!isAddingPermit}
          />
          <DateField
            value={newPermitDate}
            onChange={setNewPermitDate}
            placeholder={t('trailers', 'permitDatePlaceholder')}
          />
          <Text style={[styles.label, styles.chipLabel]}>{t('trailers', 'permitValidityLabel')}</Text>
          {renderYearChips(newPermitYears, setNewPermitYears, isAddingPermit)}
          <FluidPressable
            style={[styles.saveButton, isAddingPermit && styles.buttonDisabled]}
            onPress={handleAddPermit}
            disabled={isAddingPermit}
          >
            {isAddingPermit ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.saveButtonText}>{t('trailers', 'permitAddButton')}</Text>
            )}
          </FluidPressable>
        </View>

        {/* Quittiert wird das gespeicherte Datum — wie beim LKW. */}
        {!!params.pickerlDueDate && pickerlDueDate === params.pickerlDueDate && (
          <FluidPressable
            style={[styles.pickerlButton, busy && styles.buttonDisabled]}
            onPress={handlePickerlDone}
            disabled={busy}
          >
            {isPickerlSaving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.pickerlButtonText}>{t('vehicles', 'pickerlDoneButton')}</Text>
            )}
          </FluidPressable>
        )}

        <FluidPressable
          style={[styles.deleteButton, busy && styles.buttonDisabled]}
          onPress={handleDelete}
          disabled={busy}
        >
          {isDeleting ? (
            <ActivityIndicator color={c.tint} />
          ) : (
            <Text style={styles.deleteButtonText}>{t('trailers', 'deleteButton')}</Text>
          )}
        </FluidPressable>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c, scheme } = theme;
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
    cardSpaced: {
      marginTop: Spacing.md,
    },
    permitActions: {
      flexDirection: 'row',
      gap: Spacing.lg,
    },
    chipLabel: {
      marginTop: Spacing.sm,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    chip: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.pill,
      backgroundColor: c.surfaceTertiary,
    },
    chipActive: {
      backgroundColor: c.tint,
    },
    chipText: {
      ...Typography.footnote,
      fontWeight: '600',
      color: c.text,
    },
    chipTextActive: {
      color: '#FFFFFF',
    },
    dangerLink: {
      color: c.danger,
    },
    permitAddLabel: {
      marginTop: Spacing.lg,
    },
    sectionTitle: {
      ...Typography.title3,
      marginBottom: Spacing.md,
      color: c.text,
    },
    sectionSubTitle: {
      ...u.sectionTitle,
      marginTop: Spacing.xs,
      paddingHorizontal: 0,
    },
    label: {
      ...Typography.caption1,
      fontWeight: '600',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: Spacing.xs - 2,
    },
    input: {
      ...u.input,
      marginBottom: Spacing.md,
      backgroundColor: c.surfaceSecondary,
      borderColor: 'transparent',
    },
    hint: {
      ...u.hint,
      marginTop: Spacing.xs - 2,
      marginBottom: Spacing.md,
    },
    statusBox: {
      backgroundColor: c.surfaceSecondary,
      borderRadius: Radius.md,
      padding: Spacing.sm,
      marginTop: Spacing.sm,
    },
    statusText: {
      ...Typography.subhead,
      color: c.text,
      fontWeight: '600',
    },
    statusRemaining: {
      ...Typography.subhead,
      color: c.textSecondary,
      marginTop: 2,
    },
    statusDue: {
      color: c.danger,
      fontWeight: '700',
    },
    clearLink: {
      ...Typography.footnote,
      color: c.tint,
      fontWeight: '600',
      marginTop: Spacing.xs,
    },
    saveButton: {
      ...u.primaryButton,
      marginTop: Spacing.xs,
    },
    saveButtonText: u.primaryButtonText,
    buttonDisabled: u.disabled,
    // Wie der "Pickerl erledigt"-Button beim LKW.
    pickerlButton: {
      ...u.primaryButton,
      backgroundColor: scheme === 'dark' ? c.surfaceTertiary : Colors.ui.tertiary,
      marginTop: Spacing.md,
    },
    pickerlButtonText: {
      ...u.primaryButtonText,
      color: '#FFFFFF',
    },
    deleteButton: {
      ...u.tintedButton,
      marginTop: Spacing.md,
    },
    deleteButtonText: u.tintedButtonText,
  });
};
