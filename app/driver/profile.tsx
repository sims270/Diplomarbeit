import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Layout, shadow, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useAuth } from '@/app/context/AuthContext';
import { useTranslation } from '@/hooks/use-translation';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function DriverProfileScreen() {
  const styles = useThemedStyles(createStyles);
  const { c } = useAppTheme();
  const { user, isLoading, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'profile' | 'settings'>('profile');

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

      {/* Über den Tabs, damit der Weg zurück in beiden Reitern gleich
          bleibt. canGoBack(): Im Web lässt sich das Profil direkt über
          seine URL öffnen — dann gibt es keinen Eintrag, zu dem back()
          zurückspringen könnte, und ohne diesen Zweig passierte nichts. */}
      <View style={styles.backBar}>
        <FluidPressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/driver'))}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>
      </View>

      <View style={styles.tabsContainer}>
        <FluidPressable
          style={[styles.tab, activeTab === 'profile' && styles.tabActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>
            {t('driverProfile', 'tabProfile')}
          </Text>
        </FluidPressable>
        <FluidPressable
          style={[styles.tab, activeTab === 'settings' && styles.tabActive]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>
            {t('driverProfile', 'tabSettings')}
          </Text>
        </FluidPressable>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {activeTab === 'profile' ? (
          <>
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
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>{t('driverProfile', 'statsTrips')}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>0 km</Text>
                <Text style={styles.statLabel}>{t('driverProfile', 'statsDistance')}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>0h</Text>
                <Text style={styles.statLabel}>{t('driverProfile', 'statsDuration')}</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>{t('driverProfile', 'accountSection')}</Text>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>{t('driverProfile', 'usernameLabel')}</Text>
              <Text style={styles.settingValue}>{user?.username}</Text>
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>{t('driverProfile', 'roleLabel')}</Text>
              <Text style={styles.settingValue}>{t('driverProfile', 'roleValue')}</Text>
            </View>
          </View>
        )}
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
    tab: u.segment,
    tabActive: u.segmentActive,
    tabText: u.segmentText,
    tabTextActive: u.segmentTextActive,
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
