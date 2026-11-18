import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DirectionSection } from '@/components/DirectionSection';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { TankPricesSection } from '@/components/TankPricesSection';
import { Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useAuth } from '@/app/context/AuthContext';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert } from '@/lib/alert';
import { useRouter } from 'expo-router';
import { type ComponentProps, useEffect, useState } from 'react';
import {
  exportTankEntries,
  TANKLISTE_FILE_KEY,
} from '../../services/tankEntryService';
import {
  exportExternalProfitList,
  exportRevenueList,
  exportWeeklyRevenueList,
  GEWINNLISTE_FILE_KEY,
  UMSATZLISTE_2_FILE_KEY,
  UMSATZLISTE_FILE_KEY,
} from '../../services/revenueListService';
import {
  FileLockedError,
  getRememberedFileName,
  SaveCancelledError,
  supportsRememberedFile,
} from '@/lib/rememberedFile';
import { getVehicles } from '../../services/licensePlateService';
import { plateKey } from '@/lib/plateKey';

import { currentMonth } from '@/lib/month';
import { MonthPicker } from '@/components/MonthPicker';

type ListTab = 'prices' | 'directions';

// Listen-Tab des Chefs, von oben nach unten: Filter für Monat und Kennzeichen,
// die drei Excel-Exporte und darunter in zwei Reitern, was noch einzutragen
// ist — Tankpreise oder Richtungen.
export default function ChefTankTabScreen() {
  const styles = useThemedStyles(createStyles);
  const { c } = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();
  // Pull-to-Refresh lädt beide Abschnitte neu.
  const [refreshSignal, setRefreshSignal] = useState(0);

  // Standardmäßig der laufende Monat; zurückblättern geht beliebig weit.
  const [month, setMonth] = useState(currentMonth);
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null);
  const [plates, setPlates] = useState<string[]>([]);

  const [activeTab, setActiveTab] = useState<ListTab>('prices');
  // Was in jedem Reiter noch fehlt — steht als Zahl auf dem Reiter.
  const [missingPrices, setMissingPrices] = useState(0);
  const [missingDirections, setMissingDirections] = useState(0);

  // Auswahl aus den Fahrzeugen: Jedes Kennzeichen aus einer Tankung legt der
  // Trigger dort an (20260911110000_add_fleet_to_license_plates.sql).
  // Ausgeflottete bleiben drin — ihre alten Monate sollen filterbar bleiben.
  useEffect(() => {
    getVehicles()
      .then((vehicles) => setPlates(vehicles.map((vehicle) => vehicle.plate)))
      .catch(() => setPlates([]));
  }, [refreshSignal]);

  const [isExporting, setIsExporting] = useState(false);
  // In welche Datei der Export schreibt — null, solange noch keine gewählt
  // ist oder der Browser das Speichern in eine Datei nicht kann.
  const [exportFileName, setExportFileName] = useState<string | null>(null);

  // Dasselbe für die Umsatzliste — eigene Datei, eigener Ladezustand.
  const [isExportingRevenue, setIsExportingRevenue] = useState(false);
  const [revenueFileName, setRevenueFileName] = useState<string | null>(null);

  // Und für die Umsatzliste 2.
  const [isExportingWeekly, setIsExportingWeekly] = useState(false);
  const [weeklyFileName, setWeeklyFileName] = useState<string | null>(null);

  // Und für die Gewinnliste.
  const [isExportingProfit, setIsExportingProfit] = useState(false);
  const [profitFileName, setProfitFileName] = useState<string | null>(null);

  useEffect(() => {
    getRememberedFileName(GEWINNLISTE_FILE_KEY).then(setProfitFileName);
    getRememberedFileName(UMSATZLISTE_2_FILE_KEY).then(setWeeklyFileName);
    getRememberedFileName(TANKLISTE_FILE_KEY).then(setExportFileName);
    getRememberedFileName(UMSATZLISTE_FILE_KEY).then(setRevenueFileName);
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

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

  const handleExportUmsatzliste2 = async (chooseNewFile = false) => {
    setIsExportingWeekly(true);
    try {
      const result = await exportWeeklyRevenueList({ chooseNewFile });
      if (result.savedTo === 'file') {
        setWeeklyFileName(result.fileName);
        showAlert(
          t('common', 'success'),
          `${t('chefDashboard', 'exportUmsatzliste2SavedTo')} "${result.fileName}"`
        );
      }
    } catch (error) {
      if (error instanceof SaveCancelledError) return;

      showAlert(
        t('common', 'error'),
        error instanceof Error ? error.message : t('chefDashboard', 'exportTanklisteError')
      );
    } finally {
      setIsExportingWeekly(false);
    }
  };

  const handleExportGewinnliste = async (chooseNewFile = false) => {
    setIsExportingProfit(true);
    try {
      const result = await exportExternalProfitList({ chooseNewFile });
      if (result.savedTo === 'file') {
        setProfitFileName(result.fileName);
        showAlert(
          t('common', 'success'),
          `${t('chefDashboard', 'exportGewinnlisteSavedTo')} "${result.fileName}"`
        );
      }
    } catch (error) {
      if (error instanceof SaveCancelledError) return;

      showAlert(
        t('common', 'error'),
        error instanceof Error ? error.message : t('chefDashboard', 'exportTanklisteError')
      );
    } finally {
      setIsExportingProfit(false);
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

  const tabs: { key: ListTab; label: string; missing: number }[] = [
    { key: 'prices', label: t('chefDashboard', 'listTabPrices'), missing: missingPrices },
    { key: 'directions', label: t('chefDashboard', 'listTabDirections'), missing: missingDirections },
  ];

  return (
    <View style={styles.container}>
      <Header
        title="TRANSLOG PRO"
        subtitle={t('chefTankliste', 'headerSubtitle')}
        code="CH"
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => setRefreshSignal((n) => n + 1)}
            />
          }
        >
          <MonthPlateFilter
            month={month}
            onMonthChange={setMonth}
            plates={plates}
            selectedPlate={selectedPlate}
            onPlateChange={setSelectedPlate}
          />

          <View style={styles.exports}>
            <Text style={styles.exportsTitle}>{t('chefDashboard', 'exportsTitle')}</Text>
            <View style={styles.exportGrid}>
              <ExportTile
                icon="local-gas-station"
                title={t('chefDashboard', 'exportTanklisteName')}
                description={t('chefDashboard', 'exportTanklisteDescription')}
                isExporting={isExporting}
                fileName={exportFileName}
                onExport={handleExportTankliste}
              />
              <ExportTile
                icon="bar-chart"
                title={t('chefDashboard', 'exportUmsatzlisteName')}
                description={t('chefDashboard', 'exportUmsatzlisteDescription')}
                isExporting={isExportingRevenue}
                fileName={revenueFileName}
                onExport={handleExportUmsatzliste}
              />
              <ExportTile
                icon="calendar-view-week"
                title={t('chefDashboard', 'exportUmsatzliste2Name')}
                description={t('chefDashboard', 'exportUmsatzliste2Description')}
                isExporting={isExportingWeekly}
                fileName={weeklyFileName}
                onExport={handleExportUmsatzliste2}
              />
              <ExportTile
                icon="trending-up"
                title={t('chefDashboard', 'exportGewinnlisteName')}
                description={t('chefDashboard', 'exportGewinnlisteDescription')}
                isExporting={isExportingProfit}
                fileName={profitFileName}
                onExport={handleExportGewinnliste}
              />
            </View>
          </View>

          <View style={styles.tabs}>
            {tabs.map((tab) => {
              const isActive = tab.key === activeTab;
              return (
                <FluidPressable
                  key={tab.key}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>
                    {tab.label}
                  </Text>
                  {tab.missing > 0 && (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeText}>{tab.missing}</Text>
                    </View>
                  )}
                </FluidPressable>
              );
            })}
          </View>

          {/* Beide bleiben geladen: So stimmen die Zahlen auf den Reitern, und
              halb getippte Preise gehen beim Wechseln nicht verloren. */}
          <View style={activeTab === 'prices' ? undefined : styles.hidden}>
            <TankPricesSection
              refreshSignal={refreshSignal}
              month={month}
              selectedPlate={selectedPlate}
              onMissingCount={setMissingPrices}
            />
          </View>
          <View style={activeTab === 'directions' ? undefined : styles.hidden}>
            <DirectionSection
              refreshSignal={refreshSignal}
              month={month}
              selectedPlate={selectedPlate}
              onMissingCount={setMissingDirections}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Monat (‹ September 2026 ›) und Kennzeichen für beide Listen. Über den
 * laufenden Monat hinaus lässt sich nicht blättern — da gibt es noch nichts.
 */
function MonthPlateFilter({
  month,
  onMonthChange,
  plates,
  selectedPlate,
  onPlateChange,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  plates: string[];
  selectedPlate: string | null;
  onPlateChange: (plate: string | null) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  return (
    <View style={styles.filterBar}>
      <View style={styles.filterCard}>
        <View style={styles.filterMonth}>
          <MonthPicker month={month} onChange={onMonthChange} />
        </View>

        <ScrollView
          horizontal
          style={styles.flexShrink}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.plateRow}
        >
          {[null, ...plates].map((plate) => {
            const key = plate === null ? null : plateKey(plate);
            const isActive = key === selectedPlate;
            return (
              <FluidPressable
                key={key ?? 'all'}
                style={[styles.plateChip, isActive && styles.plateChipActive]}
                onPress={() => onPlateChange(key)}
              >
                <Text style={[styles.plateChipText, isActive && styles.plateChipTextActive]}>
                  {plate ?? t('chefTankliste', 'filterPlateAll')}
                </Text>
              </FluidPressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

/** Eine Excel-Liste: wofür sie ist, der Export-Button und die gewählte Datei. */
function ExportTile({
  icon,
  title,
  description,
  isExporting,
  fileName,
  onExport,
}: {
  icon: ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  description: string;
  isExporting: boolean;
  fileName: string | null;
  onExport: (chooseNewFile?: boolean) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { c } = useAppTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.exportTile}>
      <View style={styles.exportHead}>
        <View style={styles.exportIcon}>
          <MaterialIcons name={icon} size={22} color={c.tint} />
        </View>
        <View style={styles.exportHeadText}>
          <Text style={styles.exportTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.exportDescription} numberOfLines={2}>{description}</Text>
        </View>
      </View>

      <FluidPressable
        style={[styles.exportButton, isExporting && styles.exportButtonDisabled]}
        onPress={() => onExport()}
        disabled={isExporting}
      >
        {isExporting ? (
          <ActivityIndicator size="small" color={c.onTint} />
        ) : (
          <>
            <MaterialIcons name="file-download" size={18} color={c.onTint} />
            <Text style={styles.exportButtonText}>{t('chefDashboard', 'exportButton')}</Text>
          </>
        )}
      </FluidPressable>

      {/* Nur wo der Browser direkt in eine Datei schreiben kann (Edge,
          Chrome am Computer). Sonst gibt es nichts zu wählen, der Export
          geht wie bisher in "Downloads". */}
      {supportsRememberedFile() && (
        <View style={styles.exportFileRow}>
          <Text style={styles.exportFileText} numberOfLines={1}>
            {fileName ?? t('chefDashboard', 'exportNoFileShort')}
          </Text>
          {fileName && (
            <FluidPressable onPress={() => onExport(true)} disabled={isExporting}>
              <Text style={styles.exportFileLink}>{t('chefDashboard', 'exportChangeShort')}</Text>
            </FluidPressable>
          )}
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c, isTablet, isDesktop } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    container: u.screen,
    loadingContainer: {
      ...u.screen,
      justifyContent: 'center',
      alignItems: 'center',
    },
    flex: {
      flex: 1,
    },
    flexShrink: {
      flexShrink: 1,
      minWidth: 0,
    },
    hidden: {
      display: 'none',
    },
    filterBar: {
      ...u.column,
      paddingBottom: 0,
    },
    filterCard: {
      ...u.card,
      flexDirection: isDesktop ? 'row' : 'column',
      alignItems: isDesktop ? 'center' : 'stretch',
      gap: isDesktop ? Spacing.lg : Spacing.xs,
    },
    filterMonth: {
      width: isDesktop ? 280 : undefined,
      // Der Monatswähler bringt seinen eigenen Abstand nach unten mit.
      marginBottom: isDesktop ? -Spacing.sm : 0,
    },
    plateRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    plateChip: {
      minHeight: Layout.minTouch,
      justifyContent: 'center',
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      backgroundColor: c.surfaceTertiary,
    },
    plateChipActive: {
      backgroundColor: c.tintFill,
    },
    plateChipText: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.text,
    },
    plateChipTextActive: {
      color: c.onTint,
    },
    exports: {
      ...u.inset,
      marginTop: Spacing.lg,
    },
    exportsTitle: {
      ...u.sectionTitle,
      marginTop: 0,
    },
    // Laptop: vier nebeneinander, Tablet: zwei mal zwei, Handy: untereinander.
    exportGrid: {
      flexDirection: isTablet ? 'row' : 'column',
      flexWrap: isTablet && !isDesktop ? 'wrap' : 'nowrap',
      gap: Spacing.sm,
    },
    exportTile: {
      ...u.card,
      flexGrow: isTablet ? 1 : 0,
      flexBasis: isDesktop ? 0 : isTablet ? '45%' : 'auto',
      minWidth: 0,
      gap: Spacing.sm,
    },
    exportHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    exportIcon: {
      width: 44,
      height: 44,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.tintSoft,
    },
    exportHeadText: {
      flex: 1,
      minWidth: 0,
    },
    exportTitle: {
      ...Typography.headline,
      color: c.text,
    },
    exportDescription: {
      ...Typography.footnote,
      color: c.textSecondary,
    },
    exportButton: {
      ...u.primaryButton,
      minHeight: 44,
      paddingHorizontal: Spacing.sm,
    },
    exportButtonText: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.onTint,
    },
    exportButtonDisabled: u.disabled,
    exportFileRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.xs,
      minHeight: Layout.minTouch,
      marginVertical: -Spacing.xs,
    },
    exportFileText: {
      ...Typography.footnote,
      flex: 1,
      color: c.textSecondary,
    },
    exportFileLink: {
      ...Typography.footnote,
      fontWeight: '600',
      color: c.tint,
      minHeight: Layout.minTouch,
      lineHeight: Layout.minTouch,
      paddingLeft: Spacing.xs,
    },
    tabs: {
      ...u.segmented,
      marginTop: Spacing.xl,
      marginBottom: 0,
    },
    tab: {
      ...u.segment,
      minHeight: Layout.minTouch,
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    tabActive: u.segmentActive,
    tabText: {
      ...u.segmentText,
      flexShrink: 1,
    },
    tabTextActive: u.segmentTextActive,
    tabBadge: {
      minWidth: 20,
      height: 20,
      paddingHorizontal: 6,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.tintFill,
    },
    tabBadgeText: {
      ...Typography.caption2,
      fontWeight: '700',
      color: c.onTint,
    },
  });
};
