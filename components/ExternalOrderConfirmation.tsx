import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { withdrawDeadline } from '@/app/services/externalDriverOrderService';
import {
  bossConfirmExternalOrder,
  bossResetExternalOrderConfirmation,
  type ExternalOrder,
} from '@/app/services/externalOrderService';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Layout, Spacing, Typography } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert, showConfirm } from '@/lib/alert';
import { dateToTimeString, timestampToGerman } from '@/lib/dateFormat';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

/**
 * Der Kasten "Auftragsbestätigung" im Fremdauftrag des Chefs
 * (app/chef/external-order/[id].tsx). Zeigt, ob und wie der Frächter
 * bestätigt hat, ob er noch zurücktreten kann, oder dass er zurückgetreten
 * ist. Für Frächter ohne App trägt der Chef eine telefonische Bestätigung
 * hier ein. Regeln: 20261119190000_external_order_confirmation.sql.
 */
export function ExternalOrderConfirmation({
  order,
  onChanged,
}: {
  order: ExternalOrder;
  onChanged: (updated: ExternalOrder) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { c } = useAppTheme();
  const { t } = useTranslation();
  const [isBusy, setIsBusy] = useState(false);
  // Damit "Rücktritt bis …" nach Ablauf der Stunde von selbst zu "verbindlich" wird.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const run = async (action: () => Promise<ExternalOrder>) => {
    setIsBusy(true);
    try {
      onChanged(await action());
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      showAlert(
        t('common', 'error'),
        message === 'EXT_CONFIRM_ALREADY'
          ? t('orderConfirmation', 'errorAlready')
          : message || t('orderConfirmation', 'chefActionFailed')
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirm = () =>
    showConfirm(
      t('orderConfirmation', 'chefConfirmTitle'),
      t('orderConfirmation', 'chefConfirmMessage').replace('{orderNr}', order.orderNr),
      () => run(() => bossConfirmExternalOrder(order.id)),
      { confirmText: t('orderConfirmation', 'chefConfirm'), cancelText: t('common', 'cancel') }
    );

  const handleReset = () =>
    showConfirm(
      t('orderConfirmation', 'chefResetTitle'),
      t('orderConfirmation', 'chefResetMessage').replace('{orderNr}', order.orderNr),
      () => run(() => bossResetExternalOrderConfirmation(order.id)),
      {
        confirmText: t('orderConfirmation', 'chefResetConfirm'),
        cancelText: t('common', 'cancel'),
        destructive: true,
      }
    );

  let tone: 'pending' | 'open' | 'done' | 'withdrawn';
  let lines: string[];
  let action: { label: string; onPress: () => void; danger?: boolean } | null = null;

  if (order.confirmedAt) {
    const confirmedOn = timestampToGerman(order.confirmedAt);
    if (order.confirmedVia === 'boss') {
      tone = 'done';
      lines = [t('orderConfirmation', 'chefConfirmedBoss').replace('{date}', confirmedOn)];
      action = { label: t('orderConfirmation', 'chefResetButton'), onPress: handleReset, danger: true };
    } else {
      const deadline = withdrawDeadline(order);
      const canStillWithdraw = deadline !== null && deadline.getTime() > now;
      tone = canStillWithdraw ? 'open' : 'done';
      lines = [t('orderConfirmation', 'chefConfirmedApp').replace('{date}', confirmedOn)];
      if (order.licensePlate || order.driverName) {
        lines.push(
          t('orderConfirmation', 'chefConfirmedDriver')
            .replace('{plate}', order.licensePlate || '—')
            .replace('{driver}', order.driverName || '—')
        );
      }
      lines.push(
        canStillWithdraw
          ? t('orderConfirmation', 'chefWithdrawable').replace('{time}', dateToTimeString(deadline))
          : t('orderConfirmation', 'chefBinding')
      );
    }
  } else if (order.withdrawnAt) {
    tone = 'withdrawn';
    lines = [
      t('orderConfirmation', 'chefWithdrawn')
        .replace('{label}', order.withdrawnByLabel || '—')
        .replace('{date}', timestampToGerman(order.withdrawnAt)),
    ];
    action = { label: t('orderConfirmation', 'chefConfirmButton'), onPress: handleConfirm };
  } else {
    tone = 'pending';
    lines = [t('orderConfirmation', 'chefNotConfirmed'), t('orderConfirmation', 'chefNotConfirmedHint')];
    action = { label: t('orderConfirmation', 'chefConfirmButton'), onPress: handleConfirm };
  }

  // Erledigte Aufträge: nur noch anzeigen, nichts mehr ändern.
  if (order.status === 'completed') action = null;

  const icon =
    tone === 'done' ? 'verified' : tone === 'withdrawn' ? 'error' : tone === 'open' ? 'schedule' : 'hourglass-empty';
  const iconColor =
    tone === 'done' ? c.success : tone === 'withdrawn' ? c.danger : c.textSecondary;

  return (
    <View style={[styles.section, styles[tone]]}>
      <Text style={styles.title}>
        <MaterialIcons name={icon} size={20} color={iconColor} />{' '}
        {t('orderConfirmation', 'sectionTitle')}
      </Text>
      {lines.map((line) => (
        <Text key={line} style={[styles.text, tone === 'withdrawn' && styles.textDanger]}>
          {line}
        </Text>
      ))}
      {action && (
        <FluidPressable
          style={[action.danger ? styles.dangerButton : styles.button, isBusy && styles.disabled]}
          onPress={action.onPress}
          disabled={isBusy}
        >
          {isBusy ? (
            <ActivityIndicator color={action.danger ? c.danger : c.text} />
          ) : (
            <Text style={action.danger ? styles.dangerButtonText : styles.buttonText}>
              {action.label}
            </Text>
          )}
        </FluidPressable>
      )}
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
      borderLeftWidth: 4,
      gap: Spacing.xxs,
    },
    pending: { borderLeftColor: c.separator },
    open: { borderLeftColor: c.tintFill },
    done: { borderLeftColor: c.success },
    withdrawn: { borderLeftColor: c.danger, backgroundColor: c.dangerSoft },
    title: {
      ...Typography.title3,
      color: c.text,
      marginBottom: Spacing.xs,
    },
    text: {
      ...Typography.subhead,
      color: c.text,
    },
    textDanger: {
      color: c.danger,
      fontWeight: '600',
    },
    button: {
      alignSelf: 'flex-start',
      minHeight: Layout.minTouch,
      justifyContent: 'center',
      paddingHorizontal: Spacing.md,
      marginTop: Spacing.sm,
      borderRadius: 999,
      backgroundColor: c.surfaceSecondary,
    },
    buttonText: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.text,
    },
    dangerButton: {
      alignSelf: 'flex-start',
      minHeight: Layout.minTouch,
      justifyContent: 'center',
      paddingHorizontal: Spacing.md,
      marginTop: Spacing.sm,
      borderRadius: 999,
      backgroundColor: c.dangerSoft,
    },
    dangerButtonText: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.danger,
    },
    disabled: u.disabled,
  });
};
