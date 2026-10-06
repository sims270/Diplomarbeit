import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ActivityIndicator, StyleSheet, View, Text, ScrollView } from 'react-native';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { shadow, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useAuth } from '@/app/context/AuthContext';
import { getDrivers } from '@/app/services/driverService';
import { getAllOrders } from '@/app/services/orderService';
import { getBillableOrders } from '@/app/services/invoiceService';
import { currentMonth, isInMonth } from '@/lib/month';
import { useTranslation } from '@/hooks/use-translation';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

export default function ChefProfileScreen() {
  const styles = useThemedStyles(createStyles);
  const { c } = useAppTheme();
  const { user, isLoading, isAuthenticated, isOfflineMode } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'profile' | 'settings'>('profile');
  // null = noch nicht geladen oder nicht ermittelbar (Offline-Modus, Fehler)
  const [driverCount, setDriverCount] = useState<number | null>(null);
  // Eigene Aufträge im laufenden Monat — Monat wie auf dem Dashboard:
  // Ladedatum, sonst Entladedatum.
  const [monthOrderCount, setMonthOrderCount] = useState<number | null>(null);
  // Erledigte Aufträge (eigene und Fremdaufträge) auf noch keiner Rechnung —
  // da liegt Geld, das noch nicht verlangt wurde.
  const [unbilledCount, setUnbilledCount] = useState<number | null>(null);

  const loadStats = useCallback(async () => {
    // Im Offline-Modus fehlt das JWT, das die Edge Function verlangt — der
    // Aufruf würde zwangsläufig scheitern (siehe app/chef/drivers/index.tsx).
    if (isOfflineMode) {
      setDriverCount(null);
      setMonthOrderCount(null);
      setUnbilledCount(null);
      return;
    }

    // Unabhängig voneinander: Scheitert eine Zahl, zeigen die anderen
    // trotzdem ihren Wert.
    const month = currentMonth();
    await Promise.all([
      getDrivers()
        .then((drivers) => setDriverCount(drivers.length))
        .catch(() => setDriverCount(null)),
      getAllOrders()
        .then((orders) =>
          setMonthOrderCount(
            orders.filter((o) => isInMonth(o.loadingDate || o.unloadingDate, month)).length
          )
        )
        .catch(() => setMonthOrderCount(null)),
      getBillableOrders()
        .then((orders) => setUnbilledCount(orders.length))
        .catch(() => setUnbilledCount(null)),
    ]);
  }, [isOfflineMode]);

  // Beim Öffnen neu laden, damit die Zahlen nach dem Anlegen eines Fahrers,
  // eines Auftrags oder einer Rechnung stimmen.
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
                <MaterialIcons name="verified-user" size={15} /> {t('chefProfile', 'accountBadge')}
              </Text>
              <Text style={styles.profileUsername}>@{user?.username}</Text>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{driverCount ?? '—'}</Text>
                <Text style={styles.statLabel}>{t('chefProfile', 'statsDrivers')}</Text>
              </View>
              {/* Öffnet die Auftragsliste des laufenden Monats. */}
              <FluidPressable
                style={styles.statBox}
                onPress={() =>
                  router.push({ pathname: '/chef/order', params: { month: currentMonth() } })
                }
              >
                <Text style={styles.statValue}>{monthOrderCount ?? '—'}</Text>
                <Text style={styles.statLabel}>{t('chefProfile', 'statsOrdersMonth')}</Text>
              </FluidPressable>
              {/* Öffnet die Rechnungsübersicht beim Reiter "Zu verrechnen". */}
              <FluidPressable
                style={styles.statBox}
                onPress={() => router.push({ pathname: '/chef/invoices', params: { tab: 'open' } })}
              >
                <Text style={styles.statValue}>{unbilledCount ?? '—'}</Text>
                <Text style={styles.statLabel}>{t('chefProfile', 'statsUnbilled')}</Text>
              </FluidPressable>
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
      {/* Abmelden über den Button rechts oben im Header — hier stand er doppelt. */}
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
  });
};
