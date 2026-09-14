import { StyleSheet, ScrollView, View, Text, ActivityIndicator } from 'react-native';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { StatusCard } from '@/components/status-card';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/app/context/AuthContext';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert } from '@/lib/alert';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { getOrderStats } from '../services/orderService';
import {
  exportTankEntries,
  TANKLISTE_FILE_KEY,
} from '../services/tankEntryService';
import {
  exportRevenueList,
  UMSATZLISTE_FILE_KEY,
} from '../services/revenueListService';
import {
  FileLockedError,
  getRememberedFileName,
  SaveCancelledError,
  supportsRememberedFile,
} from '@/lib/rememberedFile';
import { getServiceStatus, getVehicles } from '../services/licensePlateService';

export default function ChefDashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();
  const [stats, setStats] = useState({ total: 0, pending: 0, assigned: 0, inProgress: 0, completed: 0 });
  const [isExporting, setIsExporting] = useState(false);
  // In welche Datei der Export schreibt — null, solange noch keine gewählt
  // ist oder der Browser das Speichern in eine Datei nicht kann.
  const [exportFileName, setExportFileName] = useState<string | null>(null);

  // Dasselbe für die Umsatzliste — eigene Datei, eigener Ladezustand.
  const [isExportingRevenue, setIsExportingRevenue] = useState(false);
  const [revenueFileName, setRevenueFileName] = useState<string | null>(null);

  useEffect(() => {
    getRememberedFileName(TANKLISTE_FILE_KEY).then(setExportFileName);
    getRememberedFileName(UMSATZLISTE_FILE_KEY).then(setRevenueFileName);
  }, []);
  // LKW mit fälligem Service. Ausgeflottete bleiben außen vor — die fahren
  // nicht mehr.
  const [serviceDue, setServiceDue] = useState<string[]>([]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
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

  const loadStats = async () => {
    try {
      setStats(await getOrderStats());
    } catch {
      // Stats are just a glance-at-a-glance summary — fall back to zeros
      // rather than blocking the rest of the dashboard on this.
    }
  };

  // Direkt aus dem Klick heraus: Dateidialog und Erlaubnisabfrage zeigt der
  // Browser nur unmittelbar nach einer Nutzeraktion (lib/rememberedFile.ts).
  const handleExportTankliste = async (chooseNewFile = false) => {
    setIsExporting(true);
    try {
      const result = await exportTankEntries({ chooseNewFile });
      if (result.savedTo === 'file') {
        setExportFileName(result.fileName);
        showAlert(
          t('common', 'success'),
          `${t('chefDashboard', 'exportSavedTo')} "${result.fileName}"`
        );
      }
    } catch (error) {
      // Dialog weggeklickt — der Chef weiß, dass er abgebrochen hat.
      if (error instanceof SaveCancelledError) return;

      showAlert(
        t('common', 'error'),
        error instanceof FileLockedError || error instanceof Error
          ? error.message
          : t('chefDashboard', 'exportTanklisteError')
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportUmsatzliste = async (chooseNewFile = false) => {
    setIsExportingRevenue(true);
    try {
      const result = await exportRevenueList({ chooseNewFile });
      if (result.savedTo === 'file') {
        setRevenueFileName(result.fileName);
        showAlert(
          t('common', 'success'),
          `${t('chefDashboard', 'exportUmsatzlisteSavedTo')} "${result.fileName}"`
        );
      }
    } catch (error) {
      if (error instanceof SaveCancelledError) return;

      showAlert(
        t('common', 'error'),
        error instanceof Error ? error.message : t('chefDashboard', 'exportTanklisteError')
      );
    } finally {
      setIsExportingRevenue(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.ui.primary} />
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

        <View style={styles.quickActionsRow}>
          <FluidPressable
            style={styles.quickActionSecondary}
            onPress={() => router.push('/chef/tankliste')}
          >
            <Text style={styles.quickActionSecondaryText}>
              {t('chefDashboard', 'tanklistePricesButton')}
            </Text>
          </FluidPressable>
          <FluidPressable
            style={[styles.quickActionButton, isExporting && styles.quickActionButtonDisabled]}
            onPress={() => handleExportTankliste()}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.quickActionButtonText}>
                {t('chefDashboard', 'exportTanklisteButton')}
              </Text>
            )}
          </FluidPressable>
        </View>

        {/* Nur wo der Browser direkt in eine Datei schreiben kann (Edge,
            Chrome am Computer). Sonst gibt es nichts zu wählen, der Export
            geht wie bisher in "Downloads". */}
        {supportsRememberedFile() && (
          <View style={styles.exportFileRow}>
            <Text style={styles.exportFileText} numberOfLines={1}>
              {exportFileName
                ? `${t('chefDashboard', 'exportSavesTo')} ${exportFileName}`
                : t('chefDashboard', 'exportNoFileYet')}
            </Text>
            {exportFileName && (
              <FluidPressable
                onPress={() => handleExportTankliste(true)}
                disabled={isExporting}
              >
                <Text style={styles.exportFileLink}>
                  {t('chefDashboard', 'exportChangeFile')}
                </Text>
              </FluidPressable>
            )}
          </View>
        )}

        <View style={styles.quickActionsRow}>
          <FluidPressable
            style={styles.quickActionSecondary}
            onPress={() => router.push('/chef/umsatzliste')}
          >
            <Text style={styles.quickActionSecondaryText}>
              {t('chefDashboard', 'umsatzlisteDirectionButton')}
            </Text>
          </FluidPressable>
          <FluidPressable
            style={[
              styles.quickActionButton,
              isExportingRevenue && styles.quickActionButtonDisabled,
            ]}
            onPress={() => handleExportUmsatzliste()}
            disabled={isExportingRevenue}
          >
            {isExportingRevenue ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.quickActionButtonText}>
                {t('chefDashboard', 'exportUmsatzlisteButton')}
              </Text>
            )}
          </FluidPressable>
        </View>

        {supportsRememberedFile() && (
          <View style={styles.exportFileRow}>
            <Text style={styles.exportFileText} numberOfLines={1}>
              {revenueFileName
                ? `${t('chefDashboard', 'exportSavesTo')} ${revenueFileName}`
                : t('chefDashboard', 'exportNoFileYet')}
            </Text>
            {revenueFileName && (
              <FluidPressable
                onPress={() => handleExportUmsatzliste(true)}
                disabled={isExportingRevenue}
              >
                <Text style={styles.exportFileLink}>
                  {t('chefDashboard', 'exportChangeFile')}
                </Text>
              </FluidPressable>
            )}
          </View>
        )}

        <View style={styles.statusContainer}>
          <StatusCard
            count={stats.pending}
            label={t('chefDashboard', 'statusOpen')}
            color={Colors.ui.orange}
          />
          <StatusCard
            count={stats.assigned}
            label={t('chefDashboard', 'statusAssigned')}
            color={Colors.ui.blue}
          />
          <StatusCard
            count={stats.completed}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.lightGray,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.ui.lightGray,
  },
  content: {
    flex: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  serviceBanner: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.ui.primary,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 16,
  },
  serviceBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.ui.primary,
  },
  serviceBannerText: {
    fontSize: 13,
    color: Colors.ui.charcoal,
    marginTop: 2,
  },
  serviceBannerPlates: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.ui.tertiary,
    marginTop: 4,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: Colors.ui.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickActionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  quickActionButtonDisabled: {
    opacity: 0.6,
  },
  quickActionSecondary: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: Colors.ui.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickActionSecondaryText: {
    color: Colors.ui.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  exportFileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  exportFileText: {
    flex: 1,
    fontSize: 12,
    color: Colors.ui.darkGray,
  },
  exportFileLink: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.ui.primary,
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    textTransform: 'uppercase',
  },
  sectionHeaderButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    backgroundColor: Colors.ui.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
});
