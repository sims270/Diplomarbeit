import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Header } from '@/components/header';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { ReminderGroups } from '@/components/ReminderGroups';
import { Spacing, Typography } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { refreshReminders, useReminders } from '@/hooks/use-reminders';
import { useTranslation } from '@/hooks/use-translation';

/**
 * Alle offenen Erinnerungen des Chefs — erreichbar über den 🔔-Button im
 * Header. Auf dem Dashboard stehen sie nur am ersten Tag; hier bleiben
 * sie, bis sie erledigt sind.
 */
export default function RemindersScreen() {
  const styles = useThemedStyles(createStyles);
  const { c } = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { reminders, newToday, loaded } = useReminders();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshReminders();
    }, [])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshReminders();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('reminders', 'headerSubtitle')} code="CH" />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <FluidPressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>

        <Text style={styles.sectionTitle}>
          {t('reminders', 'title')} ({reminders.length})
        </Text>

        {!loaded ? (
          <ActivityIndicator style={styles.loading} color={c.tint} />
        ) : reminders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{t('reminders', 'emptyState')}</Text>
            <Text style={styles.emptyStateSub}>{t('reminders', 'emptyStateSub')}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.hint}>{t('reminders', 'hint')}</Text>
            <ReminderGroups
              reminders={reminders}
              variant="list"
              newKeys={newToday}
              onChanged={refreshReminders}
            />
          </>
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
    content: u.column,
    backButton: u.backButton,
    backButtonText: u.backButtonText,
    sectionTitle: u.sectionTitle,
    hint: {
      ...u.hint,
      marginBottom: Spacing.md,
    },
    loading: {
      marginTop: Spacing.xl,
    },
    emptyState: {
      ...u.card,
      alignItems: 'center',
      paddingVertical: Spacing.xl,
    },
    emptyStateText: {
      ...Typography.headline,
      color: c.text,
      textAlign: 'center',
    },
    emptyStateSub: {
      ...Typography.subhead,
      color: c.textSecondary,
      marginTop: Spacing.xxs,
      textAlign: 'center',
    },
  });
};
