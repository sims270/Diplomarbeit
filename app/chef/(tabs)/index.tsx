import { StyleSheet, ScrollView, View, Text, ActivityIndicator } from 'react-native';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { StatusCard } from '@/components/status-card';
import { Colors, shadow, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useAuth } from '@/app/context/AuthContext';
import { useTranslation } from '@/hooks/use-translation';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAllOrders, type Order } from '../../services/orderService';
import { currentMonth, isInMonth } from '@/lib/month';
import { MonthPicker } from '@/components/MonthPicker';
import { getServiceStatus, getVehicles } from '../../services/licensePlateService';

export default function ChefDashboardScreen() {
  const styles = useThemedStyles(createStyles);
  const { c } = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  // Die Kacheln zählen nur Aufträge des gewählten Monats — standardmäßig des
  // laufenden. Monat eines Auftrags: Ladedatum, sonst Entladedatum, wie beim
  // Fahrer und in der Auftragsliste.
  const [month, setMonth] = useState(currentMonth);
  const stats = useMemo(() => {
    const inMonth = orders.filter((o) => isInMonth(o.loadingDate || o.unloadingDate, month));
    return {
      pending: inMonth.filter((o) => o.status === 'pending').length,
      assigned: inMonth.filter((o) => o.status === 'assigned').length,
      completed: inMonth.filter((o) => o.status === 'completed').length,
    };
  }, [orders, month]);
  // Tankliste und Umsatzliste haben einen eigenen Tab (app/chef/(tabs)/tank.tsx).

  // LKW mit fälligem Service. Ausgeflottete bleiben außen vor — die fahren
  // nicht mehr.
  const [serviceDue, setServiceDue] = useState<string[]>([]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

  // Auf Fokus statt nur beim Mounten: so zählt die Kachel "erledigt"
  // auch die Aufträge mit, die ein Fahrer gerade abgeschlossen hat.
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        loadStats();
        loadServiceDue();
      }
    }, [isAuthenticated])
  );

  // Bei jedem Öffnen neu: Der Kilometerstand wächst durch die Tankungen der
  // Fahrer, also auch dann, wenn der Chef die App gar nicht offen hat.
  const loadServiceDue = async () => {
    try {
      const vehicles = await getVehicles();
      setServiceDue(
        vehicles
          .filter((v) => v.retiredAt === null && getServiceStatus(v)?.isDue)
          .map((v) => v.plate)
      );
    } catch {
      // Wie die Kennzahlen darunter: eine Erinnerung, kein Grund das
      // Dashboard daran scheitern zu lassen.
      setServiceDue([]);
    }
  };

  // Tippen auf eine Kachel öffnet die Auftragsliste mit genau diesen
  // Aufträgen: derselbe Status, derselbe Monat.
  const openOrders = (status: 'pending' | 'assigned' | 'completed') =>
    router.push({ pathname: '/chef/order', params: { status, month } });

  const loadStats = async () => {
    try {
      setOrders(await getAllOrders());
    } catch {
      // Stats are just a glance-at-a-glance summary — fall back to zeros
      // rather than blocking the rest of the dashboard on this.
    }
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
      <Header
        title="TRANSLOG PRO"
        subtitle={t('chefDashboard', 'headerSubtitle')}
        code="CH"
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Die Fahrerverwaltung erreicht der Chef über den 👤-Button im
            Header (components/header.tsx) — hier stand sie doppelt. */}
        {serviceDue.length > 0 && (
          <FluidPressable
            style={styles.serviceBanner}
            onPress={() => router.push('/chef/vehicles')}
          >
            <Text style={styles.serviceBannerTitle}>
              🔧 {t('vehicles', 'serviceBannerTitle')}
            </Text>
            <Text style={styles.serviceBannerText}>
              {serviceDue.length === 1
                ? t('vehicles', 'serviceBannerOne')
                : `${serviceDue.length} ${t('vehicles', 'serviceBannerMany')}`}
            </Text>
            <Text style={styles.serviceBannerPlates}>{serviceDue.join(' · ')}</Text>
          </FluidPressable>
        )}

        <View style={styles.monthBar}>
          <MonthPicker month={month} onChange={setMonth} />
        </View>

        <View style={styles.statusContainer}>
          <StatusCard
            count={stats.pending}
            onPress={() => openOrders('pending')}
            label={t('chefDashboard', 'statusOpen')}
            color={Colors.ui.orange}
          />
          <StatusCard
            count={stats.assigned}
            onPress={() => openOrders('assigned')}
            label={t('chefDashboard', 'statusAssigned')}
            color={Colors.ui.blue}
          />
          <StatusCard
            count={stats.completed}
            onPress={() => openOrders('completed')}
            label={t('chefDashboard', 'statusCompleted')}
            color={Colors.ui.green}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('chefDashboard', 'ordersToday')}</Text>
            <View style={styles.sectionHeaderButtons}>
              <FluidPressable style={styles.addButton} onPress={() => router.push('/chef/order')}>
                <Text style={styles.addButtonText}>{t('chefDashboard', 'addOrderButton')}</Text>
              </FluidPressable>
              <FluidPressable style={styles.addButton} onPress={() => router.push('/chef/external-order')}>
                <Text style={styles.addButtonText}>+ {t('chefDashboard', 'externalOrderButton')}</Text>
              </FluidPressable>
            </View>
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
    content: {
      flex: 1,
    },
    monthBar: {
      ...u.inset,
      marginTop: Spacing.md,
    },
    statusContainer: {
      ...u.inset,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      paddingVertical: Spacing.lg,
    },
    serviceBanner: {
      ...u.inset,
      ...u.card,
      borderLeftWidth: 4,
      borderLeftColor: c.tintFill,
      marginTop: Spacing.md,
      ...shadow(2, scheme),
    },
    serviceBannerTitle: {
      ...Typography.headline,
      color: c.tint,
    },
    serviceBannerText: {
      ...Typography.subhead,
      color: c.text,
      marginTop: Spacing.xxs,
    },
    serviceBannerPlates: {
      ...Typography.subhead,
      fontWeight: '700',
      color: c.textSecondary,
      marginTop: Spacing.xs,
    },
    section: {
      ...u.inset,
      paddingBottom: Spacing.xl,
    },
    sectionHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    sectionTitle: {
      ...Typography.title2,
      color: c.text,
    },
    sectionHeaderButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    addButton: u.smallButton,
    addButtonText: u.smallButtonText,
  });
};
