import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { ExpiredAccessCard } from '@/components/ExpiredAccessCard';
import { Radius, shadow, Spacing, Typography } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import {
  REMINDER_KINDS,
  type Reminder,
  type ReminderKind,
} from '@/app/services/reminderService';
import type { ExternalAccess } from '@/app/services/externalDriverAccessService';

interface ReminderGroupsProps {
  reminders: Reminder[];
  /**
   * 'compact' fürs Dashboard: Kennzeichen in einer Zeile.
   * 'list' für die Erinnerungsseite: jede Erinnerung in eigener Zeile,
   * die heute neuen mit "NEU" markiert.
   */
  variant: 'compact' | 'list';
  newKeys?: Set<string>;
  /** Nach Verlängern oder Löschen eines Zugangs. */
  onChanged: () => void | Promise<void>;
}

/** Eine Karte je Art von Erinnerung, in der Reihenfolge von REMINDER_KINDS. */
export function ReminderGroups({ reminders, variant, newKeys, onChanged }: ReminderGroupsProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const router = useRouter();

  // Titel und Zähltext je Art — dieselben Texte wie die bisherigen Hinweise.
  const texts: Record<
    Exclude<ReminderKind, 'expiredAccess'>,
    {
      title: string;
      /** Icon vor dem Titel — bisher stand hier ein Emoji. */
      icon?: ComponentProps<typeof MaterialIcons>['name'];
      one: string;
      many: string;
      route: '/chef/vehicles' | '/chef/trailers';
    }
  > = {
    service: {
      title: t('vehicles', 'serviceBannerTitle'),
      icon: 'build',
      one: t('vehicles', 'serviceBannerOne'),
      many: t('vehicles', 'serviceBannerMany'),
      route: '/chef/vehicles',
    },
    pickerl: {
      title: t('vehicles', 'pickerlBannerTitle'),
      one: t('vehicles', 'pickerlBannerOne'),
      many: t('vehicles', 'pickerlBannerMany'),
      route: '/chef/vehicles',
    },
    trailerPickerl: {
      title: t('trailers', 'pickerlBannerTitle'),
      one: t('trailers', 'pickerlBannerOne'),
      many: t('trailers', 'pickerlBannerMany'),
      route: '/chef/trailers',
    },
    permit: {
      title: t('trailers', 'permitBannerTitle'),
      one: t('trailers', 'permitBannerOne'),
      many: t('trailers', 'permitBannerMany'),
      route: '/chef/trailers',
    },
  };

  return (
    <View style={styles.groups}>
      {REMINDER_KINDS.map((kind) => {
        const items = reminders.filter((r) => r.kind === kind);
        if (items.length === 0) return null;

        if (kind === 'expiredAccess') {
          return (
            <ExpiredAccessCard
              key={kind}
              accesses={items
                .map((r) => r.access)
                .filter((a): a is ExternalAccess => a !== undefined)}
              onChanged={onChanged}
            />
          );
        }

        const text = texts[kind];
        return (
          <FluidPressable key={kind} style={styles.card} onPress={() => router.push(text.route)}>
            <Text style={styles.title}>
              {text.icon && <MaterialIcons name={text.icon} size={17} />}
              {text.icon ? ' ' : ''}
              {text.title}
            </Text>
            <Text style={styles.text}>
              {items.length === 1 ? text.one : `${items.length} ${text.many}`}
            </Text>
            {variant === 'compact' ? (
              <Text style={styles.labels}>{items.map((r) => r.label).join(' · ')}</Text>
            ) : (
              items.map((r) => (
                <View key={r.key} style={styles.row}>
                  <Text style={styles.rowLabel}>{r.label}</Text>
                  {newKeys?.has(r.key) && (
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>{t('reminders', 'newBadge')}</Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </FluidPressable>
        );
      })}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c, scheme } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    groups: {
      gap: Spacing.md,
    },
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
    labels: {
      ...Typography.subhead,
      fontWeight: '700',
      color: c.textSecondary,
      marginTop: Spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.sm,
      paddingTop: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.separator,
    },
    rowLabel: {
      ...Typography.subhead,
      fontWeight: '700',
      color: c.text,
      flexShrink: 1,
    },
    newBadge: {
      paddingHorizontal: Spacing.xs,
      paddingVertical: 2,
      borderRadius: Radius.pill,
      backgroundColor: c.tintFill,
    },
    newBadgeText: {
      ...Typography.caption1,
      fontWeight: '700',
      color: c.onTint,
    },
  });
};
