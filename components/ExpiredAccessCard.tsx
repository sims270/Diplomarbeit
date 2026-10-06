import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { EXTEND_DAY_OPTIONS } from '@/components/ExternalAccessPanel';
import { shadow, Spacing, Typography } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert, showConfirm } from '@/lib/alert';
import { isoToGerman } from '@/lib/dateFormat';
import {
  deleteAccess,
  extendAccess,
  type ExternalAccess,
} from '@/app/services/externalDriverAccessService';

interface ExpiredAccessCardProps {
  accesses: ExternalAccess[];
  /** Nach Verlängern oder Löschen — die Liste neu laden. */
  onChanged: () => void | Promise<void>;
}

/**
 * Abgelaufene Zugänge fremder Fahrer. Sie sind schon gesperrt; hier
 * entscheidet der Chef, ob gelöscht oder verlängert wird. Steht auf dem
 * Dashboard und auf der Erinnerungsseite (app/chef/reminders.tsx).
 */
export function ExpiredAccessCard({ accesses, onChanged }: ExpiredAccessCardProps) {
  const styles = useThemedStyles(createStyles);
  const { c } = useAppTheme();
  const { t } = useTranslation();
  const [busyAccessId, setBusyAccessId] = useState<string | null>(null);

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
      await onChanged();
    }
  };

  const handleExtendAccess = (access: ExternalAccess, days: number) =>
    runAccessAction(access.userId, async () => {
      await extendAccess(access, days);
    });

  const handleDeleteAccess = (access: ExternalAccess) => {
    showConfirm(
      t('externalAccess', 'deleteConfirmTitle'),
      t('externalAccess', 'deleteConfirmMessage')
        .replace('{label}', access.label)
        .replace('{username}', access.username)
        .replace('{count}', String(access.orderCount)),
      () => runAccessAction(access.userId, () => deleteAccess(access.userId)),
      {
        confirmText: t('externalAccess', 'deleteConfirmButton'),
        cancelText: t('common', 'cancel'),
        destructive: true,
      }
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        <MaterialIcons name="vpn-key" size={17} /> {t('externalAccess', 'expiredCardTitle')}
      </Text>
      <Text style={styles.text}>{t('externalAccess', 'expiredCardHint')}</Text>

      {accesses.map((access) => (
        <View key={access.userId} style={styles.row}>
          <Text style={styles.name}>
            {access.label} ({access.username})
          </Text>
          <Text style={styles.meta}>
            {`${t('externalAccess', 'expiredOn')} ${isoToGerman(access.expiresOn)} · ${
              access.orderCount === 1
                ? t('externalAccess', 'orderCountOne')
                : `${access.orderCount} ${t('externalAccess', 'orderCountMany')}`
            }`}
          </Text>
          <View style={styles.buttons}>
            {EXTEND_DAY_OPTIONS.map((days) => (
              <FluidPressable
                key={days}
                style={styles.button}
                onPress={() => handleExtendAccess(access, days)}
                disabled={busyAccessId === access.userId}
              >
                <Text style={styles.buttonText}>
                  {t('externalAccess', 'extendDays').replace('{days}', String(days))}
                </Text>
              </FluidPressable>
            ))}
            <FluidPressable
              style={styles.deleteButton}
              onPress={() => handleDeleteAccess(access)}
              disabled={busyAccessId === access.userId}
            >
              <Text style={styles.deleteButtonText}>
                {t('externalAccess', 'deleteConfirmButton')}
              </Text>
            </FluidPressable>
            {busyAccessId === access.userId && <ActivityIndicator color={c.tint} />}
          </View>
        </View>
      ))}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c, scheme } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    card: {
      ...u.card,
      borderLeftWidth: 4,
      borderLeftColor: c.tintFill,
      ...shadow(2, scheme),
    },
    title: {
      ...Typography.headline,
      color: c.tint,
    },
    text: {
      ...Typography.subhead,
      color: c.text,
      marginTop: Spacing.xxs,
    },
    row: {
      marginTop: Spacing.md,
      paddingTop: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.separator,
    },
    name: {
      ...Typography.headline,
      color: c.text,
    },
    meta: {
      ...Typography.subhead,
      color: c.textSecondary,
      marginTop: Spacing.xxs,
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
