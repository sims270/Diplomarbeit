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
import { useEffect, useState } from 'react';
import {
  exportTankEntries,
  TANKLISTE_FILE_KEY,
} from '../../services/tankEntryService';
import {
  exportRevenueList,
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

// Tankliste-Tab des Chefs: oben Preise eintragen mit dem Tankliste-Export,
// darunter Richtung eintragen mit dem Umsatzliste-Export. Darüber die
// Filterleiste für Monat und Kennzeichen, die für beide Listen gilt.
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

  useEffect(() => {
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

          <TankPricesSection
            refreshSignal={refreshSignal}
            month={month}
            selectedPlate={selectedPlate}
            action={
              <ExportAction
                label={t('chefDashboard', 'exportTanklisteButton')}
                isExporting={isExporting}
                fileName={exportFileName}
                onExport={handleExportTankliste}
              />
            }
          />

          <DirectionSection
            refreshSignal={refreshSignal}
            month={month}
            selectedPlate={selectedPlate}
            action={
              <ExportAction
                label={t('chefDashboard', 'exportUmsatzlisteButton')}
                isExporting={isExportingRevenue}
                fileName={revenueFileName}
                onExport={handleExportUmsatzliste}
              />
            }
          />
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
      <MonthPicker month={month} onChange={onMonthChange} />

      <ScrollView
        horizontal
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
  );
}

/** Export-Button mit der Zeile, in welche Datei der Export schreibt. */
function ExportAction({
  label,
  isExporting,
  fileName,
  onExport,
}: {
  label: string;
  isExporting: boolean;
  fileName: string | null;
  onExport: (chooseNewFile?: boolean) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  return (
    <View style={styles.exportAction}>
      <FluidPressable
        style={[styles.exportButton, isExporting && styles.exportButtonDisabled]}
        onPress={() => onExport()}
        disabled={isExporting}
      >
        {isExporting ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.exportButtonText}>{label}</Text>
        )}
      </FluidPressable>

      {/* Nur wo der Browser direkt in eine Datei schreiben kann (Edge,
          Chrome am Computer). Sonst gibt es nichts zu wählen, der Export
          geht wie bisher in "Downloads". */}
      {supportsRememberedFile() && (
        <View style={styles.exportFileRow}>
          <Text style={styles.exportFileText} numberOfLines={1}>
            {fileName
              ? `${t('chefDashboard', 'exportSavesTo')} ${fileName}`
              : t('chefDashboard', 'exportNoFileYet')}
          </Text>
          {fileName && (
            <FluidPressable onPress={() => onExport(true)} disabled={isExporting}>
              <Text style={styles.exportFileLink}>
                {t('chefDashboard', 'exportChangeFile')}
              </Text>
            </FluidPressable>
          )}
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c } = theme;
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
    filterBar: {
      ...u.column,
      paddingBottom: 0,
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
    exportAction: {
      marginBottom: Spacing.md,
    },
    exportButton: {
      ...u.primaryButton,
      minHeight: 48,
      paddingHorizontal: Spacing.sm,
    },
    exportButtonText: u.primaryButtonText,
    exportButtonDisabled: u.disabled,
    exportFileRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingTop: Spacing.xs,
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
      paddingHorizontal: Spacing.xs,
    },
  });
};
