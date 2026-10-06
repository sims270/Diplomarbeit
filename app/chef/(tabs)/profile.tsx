import { ActivityIndicator, StyleSheet, View, Text, ScrollView } from 'react-native';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { shadow, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useAuth } from '@/app/context/AuthContext';
import { getDrivers } from '@/app/services/driverService';
import { useTranslation } from '@/hooks/use-translation';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

export default function ChefProfileScreen() {
  const styles = useThemedStyles(createStyles);
  const { c } = useAppTheme();
  const { user, logout, isLoading, isAuthenticated, isOfflineMode } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'profile' | 'settings'>('profile');
  // null = noch nicht geladen oder nicht ermittelbar (Offline-Modus, Fehler)
  const [driverCount, setDriverCount] = useState<number | null>(null);


  const loadDriverCount = useCallback(async () => {
    // Im Offline-Modus fehlt das JWT, das die Edge Function verlangt — der
    // Aufruf würde zwangsläufig scheitern (siehe app/chef/drivers/index.tsx).
    if (isOfflineMode) {
      setDriverCount(null);
      return;
    }

    try {
      setDriverCount((await getDrivers()).length);
    } catch {
      setDriverCount(null);
    }
  }, [isOfflineMode]);

  // Beim Öffnen neu laden, damit die Zahl nach dem Anlegen oder Löschen
  // eines Fahrers stimmt.
  useFocusEffect(
    useCallback(() => {
      loadDriverCount();
    }, [loadDriverCount])
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

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
      <Header title="TRANSLOG PRO" subtitle={t('chefProfile', 'headerSubtitle')} code="CH" />

      {/* Kein Zurück-Button mehr: Das Profil ist ein Tab der Leiste unten
          (app/chef/(tabs)/_layout.tsx). */}
      <View style={styles.tabsContainer}>
        <FluidPressable
          style={[styles.tab, activeTab === 'profile' && styles.tabActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>
            {t('chefProfile', 'tabProfile')}
          </Text>
        </FluidPressable>
        <FluidPressable
          style={[styles.tab, activeTab === 'settings' && styles.tabActive]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>
            {t('chefProfile', 'tabManagement')}
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
                {t('chefProfile', 'accountBadge')}
              </Text>
              <Text style={styles.profileUsername}>@{user?.username}</Text>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{driverCount ?? '—'}</Text>
                <Text style={styles.statLabel}>{t('chefProfile', 'statsDrivers')}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>{t('chefProfile', 'statsOrders')}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>0 km</Text>
                <Text style={styles.statLabel}>{t('chefProfile', 'statsDistance')}</Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.settingsSection}>
              <Text style={styles.sectionTitle}>{t('chefProfile', 'createDriverCardTitle')}</Text>
              <Text style={styles.sectionDescription}>{t('chefProfile', 'createDriverCardDesc')}</Text>

              <FluidPressable
                style={styles.createButton}
                onPress={() => router.push('/chef/drivers')}
              >
                <Text style={styles.createButtonText}>{t('chefProfile', 'createDriverCardButton')}</Text>
              </FluidPressable>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.sectionTitle}>{t('chefProfile', 'vehiclesCardTitle')}</Text>
              <Text style={styles.sectionDescription}>{t('chefProfile', 'vehiclesCardDesc')}</Text>

              <FluidPressable
                style={styles.createButton}
                onPress={() => router.push('/chef/vehicles')}
              >
                <Text style={styles.createButtonText}>{t('chefProfile', 'vehiclesCardButton')}</Text>
              </FluidPressable>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.sectionTitle}>{t('chefProfile', 'trailersCardTitle')}</Text>
              <Text style={styles.sectionDescription}>{t('chefProfile', 'trailersCardDesc')}</Text>

              <FluidPressable
                style={styles.createButton}
                onPress={() => router.push('/chef/trailers')}
              >
                <Text style={styles.createButtonText}>{t('chefProfile', 'trailersCardButton')}</Text>
              </FluidPressable>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.sectionTitle}>{t('chefProfile', 'accountSection')}</Text>
              <Text style={styles.sectionDescription}>{t('chefProfile', 'accountCardDesc')}</Text>

              <FluidPressable
                style={styles.createButton}
                onPress={() => router.push('/chef/account')}
              >
                <Text style={styles.createButtonText}>{t('chefProfile', 'accountCardButton')}</Text>
              </FluidPressable>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.sectionTitle}>{t('chefProfile', 'bossesCardTitle')}</Text>
              <Text style={styles.sectionDescription}>{t('chefProfile', 'bossesCardDesc')}</Text>

              <FluidPressable
                style={styles.createButton}
                onPress={() => router.push('/chef/bosses')}
              >
                <Text style={styles.createButtonText}>{t('chefProfile', 'bossesCardButton')}</Text>
              </FluidPressable>
            </View>
          </>
        )}
      </ScrollView>

      <FluidPressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>{t('common', 'logout')}</Text>
      </FluidPressable>
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
    tabsContainer: {
      ...u.segmented,
      ...u.formInset,
      marginTop: Spacing.md,
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
    sectionTitle: {
      ...Typography.headline,
      paddingTop: Spacing.xs,
      marginBottom: Spacing.xxs,
      color: c.text,
    },
    settingsSection: {
      ...u.card,
      marginBottom: Spacing.md,
    },
    sectionDescription: {
      ...Typography.subhead,
      color: c.textSecondary,
      marginBottom: Spacing.md,
    },
    createButton: {
      ...u.primaryButton,
      marginTop: Spacing.xxs,
    },
    createButtonText: u.primaryButtonText,
    buttonDisabled: u.disabled,
    logoutButton: {
      ...u.formInset,
      ...u.tintedButton,
      marginTop: Spacing.xs,
      marginBottom: Spacing.lg,
    },
    logoutButtonText: u.tintedButtonText,
  });
};
