import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  completeMyOrder,
  confirmMyOrder,
  type ExternalDriverOrder,
  getMyOrder,
  setMyOrderDriver,
  withdrawDeadline,
  withdrawMyOrder,
} from '@/app/services/externalDriverOrderService';
import { OrderDocuments } from '@/components/OrderDocuments';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert, showConfirm } from '@/lib/alert';
import { dateToTimeString, isoToGerman, timestampToGerman } from '@/lib/dateFormat';
import { formatTimeWindow } from '@/lib/pdfLayout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const EMPTY = '—';

/**
 * Ein Fremdauftrag aus Sicht des fremden Fahrers: Lade- und Entladedaten,
 * Ladung, Hinweise — keine Preise (die liefert get_my_external_orders gar
 * nicht erst). Dazu CMR/Fotos hochladen, Kennzeichen und Fahrername
 * eintragen und den Auftrag abschließen.
 */
export default function ExternalOrderDetailScreen() {
  const styles = useThemedStyles(createStyles);
  const { c, scheme } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  // undefined = lädt, null = nicht gefunden (oder nicht zugewiesen, oder
  // Zugang abgelaufen — die Datenbank unterscheidet das bewusst nicht)
  const [order, setOrder] = useState<ExternalDriverOrder | undefined | null>(undefined);
  const [isCompleting, setIsCompleting] = useState(false);
  // Kennzeichen und Fahrername trägt der fremde Fahrer selbst ein — beim
  // Anlegen sind sie für den Chef optional.
  const [licensePlate, setLicensePlate] = useState('');
  const [driverName, setDriverName] = useState('');
  const [isSavingDriver, setIsSavingDriver] = useState(false);
  // Bestätigung (20261119190000_external_order_confirmation.sql).
  const [accepted, setAccepted] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  // Damit der Rücktritt-Button nach Ablauf der Stunde von selbst verschwindet.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    getMyOrder(id)
      .then((found) => {
        if (cancelled) return;
        setOrder(found ?? null);
        setLicensePlate(found?.licensePlate ?? '');
        setDriverName(found?.driverName ?? '');
      })
      .catch(() => {
        if (!cancelled) setOrder(null);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const isCompleted = order?.status === 'completed';

  const handleComplete = () => {
    if (!order) return;

    showConfirm(
      t('driverOrderDetail', 'completeConfirmTitle'),
      t('externalDriver', 'completeConfirmMessage'),
      async () => {
        setIsCompleting(true);
        try {
          await completeMyOrder(order.id);
          setOrder((await getMyOrder(order.id)) ?? null);
          showAlert(t('common', 'success'), t('driverOrderDetail', 'alertCompleted'));
        } catch (error) {
          const message =
            error instanceof Error ? error.message : t('driverOrderDetail', 'alertCompleteFailed');
          showAlert(t('common', 'error'), message);
        } finally {
          setIsCompleting(false);
        }
      },
      {
        confirmText: t('driverOrderDetail', 'completeConfirmConfirm'),
        cancelText: t('driverOrderDetail', 'completeConfirmCancel'),
      }
    );
  };

  const handleSaveDriver = async () => {
    if (!order) return;

    setIsSavingDriver(true);
    try {
      await setMyOrderDriver(order.id, licensePlate, driverName);
      const updated = await getMyOrder(order.id);
      setOrder(updated ?? null);
      setLicensePlate(updated?.licensePlate ?? '');
      setDriverName(updated?.driverName ?? '');
      showAlert(t('common', 'success'), t('externalDriver', 'alertDriverSaved'));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('externalDriver', 'alertDriverSaveFailed');
      showAlert(t('common', 'error'), message);
    } finally {
      setIsSavingDriver(false);
    }
  };

  // Die Datenbank meldet feste Kennungen; hier werden sie zu Sätzen.
  const confirmationError = (error: unknown) => {
    const message = error instanceof Error ? error.message : '';
    const known: Record<string, string> = {
      EXT_CONFIRM_NOT_ALLOWED: t('orderConfirmation', 'errorNotAllowed'),
      EXT_CONFIRM_ALREADY: t('orderConfirmation', 'errorAlready'),
      EXT_CONFIRM_DRIVER_MISSING: t('orderConfirmation', 'driverMissing'),
      EXT_WITHDRAW_EXPIRED: t('orderConfirmation', 'errorWithdrawExpired'),
      EXT_WITHDRAW_NOT_ALLOWED: t('orderConfirmation', 'errorWithdrawNotAllowed'),
    };
    return known[message] ?? (message || t('orderConfirmation', 'errorNotAllowed'));
  };

  const handleConfirm = async () => {
    if (!order) return;
    if (!accepted) {
      showAlert(t('common', 'error'), t('orderConfirmation', 'needCheckbox'));
      return;
    }
    if (!licensePlate.trim() || !driverName.trim()) {
      showAlert(t('common', 'error'), t('orderConfirmation', 'driverMissing'));
      return;
    }

    setIsConfirming(true);
    try {
      // Die Datenbank prüft die gespeicherten Werte — getippte, aber noch
      // nicht gespeicherte gehen deshalb zuerst mit.
      if (licensePlate !== order.licensePlate || driverName !== order.driverName) {
        await setMyOrderDriver(order.id, licensePlate, driverName);
      }
      await confirmMyOrder(order.id);
      const updated = await getMyOrder(order.id);
      setOrder(updated ?? null);
      const deadline = updated ? withdrawDeadline(updated) : null;
      showAlert(
        t('common', 'success'),
        t('orderConfirmation', 'confirmedSuccess').replace(
          '{time}',
          deadline ? dateToTimeString(deadline) : ''
        )
      );
    } catch (error) {
      showAlert(t('common', 'error'), confirmationError(error));
    } finally {
      setIsConfirming(false);
    }
  };

  const handleWithdraw = () => {
    if (!order) return;
    showConfirm(
      t('orderConfirmation', 'withdrawConfirmTitle'),
      t('orderConfirmation', 'withdrawConfirmMessage').replace('{orderNr}', order.orderNr),
      async () => {
        setIsWithdrawing(true);
        try {
          await withdrawMyOrder(order.id);
          showAlert(t('common', 'success'), t('orderConfirmation', 'withdrawn'));
          // Der Auftrag ist ihm entzogen und hier nicht mehr abrufbar.
          router.back();
        } catch (error) {
          showAlert(t('common', 'error'), confirmationError(error));
          setIsWithdrawing(false);
        }
      },
      {
        confirmText: t('orderConfirmation', 'withdrawConfirm'),
        cancelText: t('common', 'cancel'),
        destructive: true,
      }
    );
  };

  const renderRow = (label: string, value: string) => (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || EMPTY}</Text>
    </View>
  );

  const formatDate = (date: string) => (date ? isoToGerman(date) : EMPTY);

  /**
   * Kasten "Auftragsbestätigung" ganz oben: offen → Häkchen und Button;
   * bestätigt → Zeitpunkt und, eine Stunde lang, der Rücktritt.
   */
  const renderConfirmation = (current: ExternalDriverOrder) => {
    if (current.confirmedAt) {
      const confirmedOn = timestampToGerman(current.confirmedAt);
      const deadline = withdrawDeadline(current);
      const canWithdraw = deadline !== null && deadline.getTime() > now && !isCompleted;
      const text =
        current.confirmedVia === 'boss'
          ? t('orderConfirmation', 'confirmedByBoss').replace('{date}', confirmedOn)
          : canWithdraw
            ? t('orderConfirmation', 'confirmedWithdrawable')
                .replace('{date}', confirmedOn)
                .replace('{time}', dateToTimeString(deadline))
            : t('orderConfirmation', 'confirmedBinding').replace('{date}', confirmedOn);

      return (
        <View style={[styles.section, styles.confirmDone]}>
          <Text style={styles.sectionTitle}>
            <MaterialIcons name="verified" size={20} color={c.success} />{' '}
            {t('orderConfirmation', 'sectionTitle')}
          </Text>
          <Text style={styles.confirmText}>{text}</Text>
          {canWithdraw && (
            <FluidPressable
              style={[styles.withdrawButton, isWithdrawing && styles.completeButtonDisabled]}
              onPress={handleWithdraw}
              disabled={isWithdrawing}
            >
              {isWithdrawing ? (
                <ActivityIndicator color={c.danger} />
              ) : (
                <Text style={styles.withdrawButtonText}>
                  {t('orderConfirmation', 'withdrawButton')}
                </Text>
              )}
            </FluidPressable>
          )}
        </View>
      );
    }

    return (
      <View style={[styles.section, styles.confirmPending]}>
        <Text style={styles.sectionTitle}>{t('orderConfirmation', 'sectionTitle')}</Text>
        <Text style={styles.confirmText}>
          {t('orderConfirmation', 'pendingText').replace('{orderNr}', current.orderNr)}
        </Text>
        <FluidPressable
          style={styles.checkboxRow}
          onPress={() => setAccepted((prev) => !prev)}
          disabled={isConfirming}
        >
          <MaterialIcons
            name={accepted ? 'check-box' : 'check-box-outline-blank'}
            size={26}
            color={accepted ? c.tint : c.textSecondary}
          />
          <Text style={styles.checkboxText}>{t('orderConfirmation', 'checkbox')}</Text>
        </FluidPressable>
        <FluidPressable
          style={[
            styles.completeButton,
            (!accepted || isConfirming) && styles.completeButtonDisabled,
          ]}
          onPress={handleConfirm}
          disabled={isConfirming}
        >
          {isConfirming ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.completeButtonText}>
              {t('orderConfirmation', 'confirmButton')}
            </Text>
          )}
        </FluidPressable>
      </View>
    );
  };

  const header = (
    <Header title="TRANSLOG PRO" subtitle={t('driverOrderDetail', 'headerSubtitle')} />
  );

  if (order === undefined) {
    return (
      <View style={styles.container}>
        {header}
        <ActivityIndicator style={styles.loading} color={c.tint} />
      </View>
    );
  }

  if (order === null) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>{t('driverOrderDetail', 'notFound')}</Text>
          <FluidPressable style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>← {t('driverOrderDetail', 'back')}</Text>
          </FluidPressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <FluidPressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>← {t('driverOrderDetail', 'back')}</Text>
        </FluidPressable>

        <View style={styles.orderHeaderCard}>
          <View>
            <Text style={styles.orderNumberLabel}>{t('driverOrderDetail', 'orderNumber')}</Text>
            <Text style={styles.orderNumber}>Nr. {order.orderNr}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: isCompleted ? Colors.ui.green : Colors.ui.orange },
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {isCompleted
                ? t('externalDriver', 'statusCompleted')
                : t('externalDriver', 'statusPending')}
            </Text>
          </View>
        </View>

        {(!isCompleted || order.confirmedAt) && renderConfirmation(order)}

        {/* Laptop/Desktop: zwei Spalten nebeneinander */}
        <View style={styles.pair}>
          <View style={styles.pairItem}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('driverOrderDetail', 'pickupSection')}</Text>
              {renderRow(t('driverOrderDetail', 'companyLabel'), order.loadingCompany)}
              {renderRow(t('driverOrderDetail', 'addressLabel'), order.loadingAddress)}
              {renderRow(t('driverOrderDetail', 'dateLabel'), formatDate(order.loadingDate))}
              {renderRow(
                t('driverOrderDetail', 'timeLabel'),
                formatTimeWindow(order.loadingTimeFrom, order.loadingTimeUntil)
              )}
              {renderRow(t('externalDriver', 'loadingNumberLabel'), order.loadingNumber)}
            </View>
          </View>
          <View style={styles.pairItem}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('driverOrderDetail', 'deliverySection')}</Text>
              {renderRow(t('driverOrderDetail', 'companyLabel'), order.unloadingCompany)}
              {renderRow(t('driverOrderDetail', 'addressLabel'), order.unloadingAddress)}
              {renderRow(t('driverOrderDetail', 'dateLabel'), formatDate(order.unloadingDate))}
              {renderRow(
                t('driverOrderDetail', 'timeLabel'),
                formatTimeWindow(order.unloadingTimeFrom, order.unloadingTimeUntil)
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('driverOrderDetail', 'cargoSection')}</Text>
          {renderRow(t('externalDriver', 'cargoDescriptionLabel'), order.cargoDescription)}
          {renderRow(t('driverOrderDetail', 'loadingMetersLabel'), order.loadingMeters)}
          {renderRow(t('externalDriver', 'vehicleTypeLabel'), order.vehicleType)}
          {isCompleted ? (
            <>
              {renderRow(t('externalDriver', 'licensePlateLabel'), order.licensePlate)}
              {renderRow(t('externalDriver', 'driverNameLabel'), order.driverName)}
            </>
          ) : (
            <View style={styles.driverFields}>
              <Text style={styles.inputLabel}>{t('externalDriver', 'licensePlateLabel')}</Text>
              <TextInput
                placeholderTextColor={c.placeholder}
                keyboardAppearance={scheme}
                style={styles.input}
                value={licensePlate}
                onChangeText={setLicensePlate}
                editable={!isSavingDriver}
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>{t('externalDriver', 'driverNameLabel')}</Text>
              <TextInput
                placeholderTextColor={c.placeholder}
                keyboardAppearance={scheme}
                style={styles.input}
                value={driverName}
                onChangeText={setDriverName}
                editable={!isSavingDriver}
                autoCapitalize="words"
              />

              <FluidPressable
                style={[styles.saveDriverButton, isSavingDriver && styles.completeButtonDisabled]}
                onPress={handleSaveDriver}
                disabled={isSavingDriver}
              >
                {isSavingDriver ? (
                  <ActivityIndicator color={c.tint} />
                ) : (
                  <Text style={styles.saveDriverButtonText}>
                    {t('externalDriver', 'saveDriverButton')}
                  </Text>
                )}
              </FluidPressable>
            </View>
          )}
        </View>

        {order.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('externalDriver', 'notesSection')}</Text>
            <Text style={styles.notes}>{order.notes}</Text>
          </View>
        ) : null}

        <OrderDocuments
          orderId={order.id}
          canUpload
          canDelete={!isCompleted}
          note={t('externalDriver', 'documentsNote')}
        />

        {isCompleted ? (
          <Text style={styles.completedNote}>✓ {t('driverOrderDetail', 'alreadyCompleted')}</Text>
        ) : (
          <FluidPressable
            style={[styles.completeButton, isCompleting && styles.completeButtonDisabled]}
            onPress={handleComplete}
            disabled={isCompleting}
          >
            {isCompleting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.completeButtonText}>
                {t('driverOrderDetail', 'completeButton')}
              </Text>
            )}
          </FluidPressable>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    pair: u.pair,
    pairItem: u.pairItem,
    container: u.screen,
    content: {
      flex: 1,
    },
    contentInner: u.formColumn,
    loading: {
      marginTop: Spacing.xl,
    },
    backLink: u.backButton,
    backLinkText: u.backButtonText,
    orderHeaderCard: {
      ...u.card,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    orderNumberLabel: {
      ...Typography.caption1,
      fontWeight: '600',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 2,
    },
    orderNumber: {
      ...Typography.title2,
      color: c.text,
    },
    statusBadge: {
      ...u.badge,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xxs + 1,
    },
    statusBadgeText: u.badgeText,
    section: {
      ...u.card,
      marginBottom: Spacing.md,
    },
    sectionTitle: {
      ...Typography.title3,
      color: c.text,
      marginBottom: Spacing.xs,
    },
    // iOS-Listenzeile: Bezeichnung links, Wert rechts, Haarlinie dazwischen
    row: {
      minHeight: Layout.minTouch,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
      gap: Spacing.md,
    },
    label: {
      ...Typography.subhead,
      color: c.textSecondary,
    },
    value: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.text,
      flexShrink: 1,
      textAlign: 'right',
    },
    driverFields: {
      paddingTop: Spacing.sm,
    },
    inputLabel: {
      ...Typography.caption1,
      fontWeight: '600',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: Spacing.xxs,
    },
    input: {
      ...u.input,
      backgroundColor: c.surfaceSecondary,
      borderColor: 'transparent',
      marginBottom: Spacing.sm,
    },
    saveDriverButton: u.tintedButton,
    saveDriverButtonText: u.tintedButtonText,
    notes: {
      ...Typography.body,
      color: c.text,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    emptyStateText: {
      ...u.emptyStateText,
      marginBottom: Spacing.sm,
    },
    completeButton: {
      ...u.primaryButton,
      minHeight: 56,
    },
    completeButtonDisabled: u.disabled,
    completeButtonText: u.primaryButtonText,
    // Offene Bestätigung fällt auf, erledigte tritt zurück.
    confirmPending: {
      borderLeftWidth: 4,
      borderLeftColor: c.tintFill,
    },
    confirmDone: {
      borderLeftWidth: 4,
      borderLeftColor: c.success,
    },
    confirmText: {
      ...Typography.subhead,
      color: c.text,
      marginBottom: Spacing.sm,
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.xs,
      minHeight: Layout.minTouch,
      marginBottom: Spacing.sm,
    },
    checkboxText: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.text,
      flex: 1,
      paddingTop: 3,
    },
    withdrawButton: {
      ...u.secondaryButton,
      backgroundColor: c.dangerSoft,
    },
    withdrawButtonText: {
      ...u.secondaryButtonText,
      color: c.danger,
    },
    completedNote: {
      ...Typography.callout,
      textAlign: 'center',
      fontWeight: '600',
      color: c.success,
      paddingVertical: Spacing.xs,
    },
  });
};
