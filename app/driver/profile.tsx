import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Layout, shadow, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useAuth } from '@/app/context/AuthContext';
import { getOrdersByDriver } from '@/app/services/orderService';
import { useTranslation } from '@/hooks/use-translation';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function DriverProfileScreen() {
  const styles = useThemedStyles(createStyles);
  const { c } = useAppTheme();
  const { user, isLoading, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  // null = noch nicht geladen oder nicht ermittelbar (kein Netz, Fehler)
  const [stats, setStats] = useState<{ total: number; completed: number } | null>(null);

  const loadStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const orders = await getOrdersByDriver(user.id);
      setStats({
        total: orders.length,
        completed: orders.filter((order) => order.status === 'completed').length,
      });
    } catch {
      setStats(null);
    }
  }, [user?.id]);

  // Beim Öffnen neu laden — nach dem Erledigen eines Auftrags soll die Zahl
  // stimmen, wenn der Fahrer ins Profil wechselt.
  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={c.tint} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Header
        title="TRANSLOG PRO"
        subtitle={`${t('driverProfile', 'headerSubtitle')} - ${user?.name || t('common', 'unknown')}`}
        code={user?.username?.[0]?.toUpperCase() || 'U'}
      />

      {/* canGoBack(): Im Web lässt sich das Profil direkt über seine URL
          öffnen — dann gibt es keinen Eintrag, zu dem back() zurückspringen
          könnte, und ohne diesen Zweig passierte nichts. */}
      <View style={styles.backBar}>
        <FluidPressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/driver'))}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatar}>
                {user?.name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
            <Text style={styles.profileName}>{user?.name || t('common', 'unknown')}</Text>
            <Text style={styles.profileRole}>
              {t('driverProfile', 'accountBadge')}
            </Text>
            <Text style={styles.profileUsername}>@{user?.username}</Text>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats?.total ?? '—'}</Text>
              <Text style={styles.statLabel}>{t('driverProfile', 'statsOrders')}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats?.completed ?? '—'}</Text>
              <Text style={styles.statLabel}>{t('driverProfile', 'statsCompleted')}</Text>
            </View>
            {/* Nicht jeder Fahrer hat einen fest zugeteilten LKW. */}
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{user?.licensePlate || '—'}</Text>
              <Text style={styles.statLabel}>{t('driverProfile', 'statsVehicle')}</Text>
            </View>
          </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c, scheme } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    container: u.screen,
    loadingContainer: {
      ...u.screen,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backBar: {
      ...u.formInset,
      paddingTop: Spacing.xs,
    },
    backButton: {
      ...u.backButton,
      marginBottom: 0,
    },
    backButtonText: u.backButtonText,
    tabsContainer: {
      ...u.segmented,
      ...u.formInset,
    },
    content: {
      flex: 1,
    },
    contentInner: u.formColumn,
    profileCard: {
      ...u.card,
      padding: Spacing.lg,
      alignItems: 'center',
      marginBottom: Spacing.lg,
      ...shadow(2, scheme),
    },
    avatarContainer: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: c.tintFill,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    avatar: {
      fontSize: 36,
      lineHeight: 42,
      fontWeight: '700',
      color: c.onTint,
    },
    profileName: {
      ...Typography.title2,
      textAlign: 'center',
      marginBottom: Spacing.xxs,
      color: c.text,
    },
    profileRole: {
      ...Typography.subhead,
      color: c.textSecondary,
      marginBottom: Spacing.xs,
    },
    profileUsername: {
      ...Typography.footnote,
      color: c.textTertiary,
    },
    statsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: Spacing.lg,
      gap: Spacing.sm,
    },
    statBox: {
      ...u.card,
      flexGrow: 1,
      flexBasis: 96,
      alignItems: 'center',
    },
    statValue: {
      ...Typography.title3,
      fontWeight: '700',
      color: c.tint,
      marginBottom: Spacing.xxs,
      fontVariant: ['tabular-nums'],
    },
    statLabel: {
      ...Typography.caption1,
      color: c.textSecondary,
      textAlign: 'center',
    },
    settingsSection: {
      ...u.card,
      paddingVertical: Spacing.xs,
      marginBottom: Spacing.md,
    },
    sectionTitle: {
      ...Typography.headline,
      paddingTop: Spacing.xs,
      marginBottom: Spacing.xxs,
      color: c.text,
    },
    settingItem: {
      minHeight: Layout.minTouch,
      paddingVertical: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.md,
    },
    settingLabel: {
      ...Typography.callout,
      color: c.textSecondary,
    },
    settingValue: {
      ...Typography.callout,
      fontWeight: '600',
      color: c.text,
      flexShrink: 1,
      textAlign: 'right',
    },
  });
};
