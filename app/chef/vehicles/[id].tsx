import {
  markServiceDone,
  MAX_YEAR_BUILT,
  MIN_YEAR_BUILT,
  saveVehicleDetails,
  SERVICE_INTERVAL_OPTIONS,
  setVehicleRetired,
} from '@/app/services/licensePlateService';
import { BlurSurface } from '@/components/fluid/BlurSurface';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert, showConfirm } from '@/lib/alert';
import { isoToGerman } from '@/lib/dateFormat';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const formatKm = (km: number) => `${km.toLocaleString('de-DE')} km`;

/**
 * Marke/Typ und Baujahr eines LKW nachtragen — das einzige an einem
 * Fahrzeug, das der Chef von Hand pflegt.
 *
 * Das Kennzeichen steht hier nur zum Lesen: Es ist der Schlüssel, über den
 * die Tankungen der Fahrer dem Fahrzeug zugeordnet werden (siehe den
 * Trigger in 20260911110000_add_fleet_to_license_plates.sql). Ein
 * nachträglich geändertes Kennzeichen risse diese Zuordnung auseinander.
 * Der Kilometerstand fehlt aus demselben Grund: Er kommt aus der Tankliste.
 */
export default function EditVehicleScreen() {
  const styles = useThemedStyles(createStyles);
  const { c, scheme } = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    id: string;
    plate?: string;
    model?: string;
    yearBuilt?: string;
    retiredAt?: string;
    kmStand?: string;
    serviceIntervalKm?: string;
    lastServiceKm?: string;
  }>();

  const [model, setModel] = useState(params.model ?? '');
  const [yearBuilt, setYearBuilt] = useState(params.yearBuilt ?? '');
  const [serviceInterval, setServiceInterval] = useState<number | null>(
    params.serviceIntervalKm ? Number(params.serviceIntervalKm) : null
  );
  const [isIntervalPickerOpen, setIsIntervalPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRetiring, setIsRetiring] = useState(false);
  const [isServicing, setIsServicing] = useState(false);

  const kmStand = params.kmStand ? Number(params.kmStand) : null;
  const lastServiceKm = params.lastServiceKm ? Number(params.lastServiceKm) : null;

  // Vorschau auf den gewählten Stand, nicht auf den gespeicherten: Stellt
  // der Chef das Intervall gerade um, soll er sofort sehen, wann der
  // nächste Service dann fällig wäre.
  const serviceSince = lastServiceKm ?? kmStand ?? 0;
  const serviceDueAt = serviceInterval === null ? null : serviceSince + serviceInterval;
  const serviceRemaining =
    serviceDueAt === null || kmStand === null ? null : serviceDueAt - kmStand;

  // Kein State: Nach dem Ausflotten oder Zurückholen geht der Screen zu,
  // und die Übersicht lädt beim Zurückkommen ohnehin neu.
  const retiredAt = params.retiredAt ?? '';
  const isRetired = !!retiredAt;
  const busy = isSaving || isRetiring || isServicing;
  const label = params.plate ?? '';

  const handleSave = async () => {
    // Leer heißt "nicht eingetragen" und ist erlaubt — ein LKW entsteht in
    // der Liste auch ohne diese Angaben, sobald ein Fahrer auf sein
    // Kennzeichen tankt. Steht aber etwas drin, muss es eine plausible
    // Jahreszahl sein.
    const year = yearBuilt.trim();
    let parsedYear: number | null = null;
    if (year) {
      const parsed = Number(year);
      if (
        !Number.isInteger(parsed) ||
        parsed < MIN_YEAR_BUILT ||
        parsed > MAX_YEAR_BUILT
      ) {
        showAlert(t('common', 'error'), t('vehicles', 'alertInvalidYear'));
        return;
      }
      parsedYear = parsed;
    }

    setIsSaving(true);
    try {
      // Wird gerade erstmals ein Intervall gesetzt, ist der Nullpunkt der
      // aktuelle Kilometerstand — sonst stünde ein LKW mit 300.000 km
      // sofort als überfällig da, obwohl er eben erst beim Service war.
      await saveVehicleDetails(params.id, {
        model,
        yearBuilt: parsedYear,
        serviceIntervalKm: serviceInterval,
        lastServiceKm:
          serviceInterval === null ? lastServiceKm : lastServiceKm ?? kmStand ?? 0,
      });
      showAlert(
        t('common', 'success'),
        `"${params.plate ?? ''}" ${t('vehicles', 'alertSaved')}`
      );
      router.back();
    } catch (error) {
      showAlert(
        t('common', 'error'),
        error instanceof Error ? error.message : t('vehicles', 'alertSaveFailed')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const applyRetired = async (retired: boolean) => {
    setIsRetiring(true);
    try {
      await setVehicleRetired(params.id, retired);
      showAlert(
        t('common', 'success'),
        `"${label}" ${t('vehicles', retired ? 'alertRetired' : 'alertReactivated')}`
      );
      router.back();
    } catch (error) {
      showAlert(
        t('common', 'error'),
        error instanceof Error
          ? error.message
          : t('vehicles', retired ? 'alertRetireFailed' : 'alertReactivateFailed')
      );
    } finally {
      setIsRetiring(false);
    }
  };

  const handleServiceDone = () =>
    showConfirm(
      t('vehicles', 'serviceDoneConfirmTitle'),
      `"${label}" — ${t('vehicles', 'serviceDoneConfirmMessage')}`,
      async () => {
        setIsServicing(true);
        try {
          await markServiceDone(params.id, kmStand ?? 0);
          showAlert(t('common', 'success'), `"${label}" ${t('vehicles', 'alertServiceDone')}`);
          router.back();
        } catch (error) {
          showAlert(
            t('common', 'error'),
            error instanceof Error ? error.message : t('vehicles', 'alertServiceFailed')
          );
        } finally {
          setIsServicing(false);
        }
      },
      {
        confirmText: t('vehicles', 'serviceDoneConfirmConfirm'),
        cancelText: t('vehicles', 'serviceDoneConfirmCancel'),
      }
    );

  // Rückfrage nur beim Ausflotten. Das Zurückholen ist harmlos und
  // jederzeit wieder umkehrbar — eine Warnung davor wäre Lärm.
  const handleRetire = () =>
    showConfirm(
      t('vehicles', 'retireConfirmTitle'),
      `"${label}" ${t('vehicles', 'retireConfirmMessage')}`,
      () => applyRetired(true),
      {
        confirmText: t('vehicles', 'retireConfirmConfirm'),
        cancelText: t('vehicles', 'retireConfirmCancel'),
        destructive: true,
      }
    );

  return (
    <View style={styles.container}>
      <Header
        title="TRANSLOG PRO"
        subtitle={t('vehicles', 'editHeaderSubtitle')}
        code="CH"
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <FluidPressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('vehicles', 'editTitle')}</Text>

          {isRetired && (
            <View style={styles.retiredBanner}>
              <Text style={styles.retiredBannerTitle}>
                {`${t('vehicles', 'retiredSince')} ${isoToGerman(retiredAt.slice(0, 10))}`}
              </Text>
              <Text style={styles.retiredBannerText}>{t('vehicles', 'retiredHint')}</Text>
            </View>
          )}

          <Text style={styles.label}>{t('vehicles', 'plateLabel')}</Text>
          <View style={styles.readonlyField}>
            <Text style={styles.readonlyValue}>{params.plate}</Text>
          </View>
          <Text style={styles.hint}>{t('vehicles', 'plateLockedHint')}</Text>

          <Text style={styles.label}>{t('vehicles', 'modelLabel')}</Text>
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            value={model}
            onChangeText={setModel}
            placeholder={t('vehicles', 'modelPlaceholder')}
            editable={!isSaving}
          />

          <Text style={styles.label}>{t('vehicles', 'yearLabel')}</Text>
          <TextInput
            placeholderTextColor={c.placeholder}
            keyboardAppearance={scheme}
            style={styles.input}
            value={yearBuilt}
            onChangeText={setYearBuilt}
            placeholder={t('vehicles', 'yearPlaceholder')}
            keyboardType="numeric"
            maxLength={4}
            editable={!isSaving}
          />

          <Text style={styles.sectionSubTitle}>{t('vehicles', 'serviceSection')}</Text>

          <Text style={styles.label}>{t('vehicles', 'serviceIntervalLabel')}</Text>
          <FluidPressable
            style={styles.selectField}
            onPress={() => setIsIntervalPickerOpen(true)}
            disabled={busy}
          >
            <Text style={serviceInterval ? styles.selectValue : styles.selectPlaceholder}>
              {serviceInterval
                ? formatKm(serviceInterval)
                : t('vehicles', 'serviceIntervalPlaceholder')}
            </Text>
            <Text style={styles.selectChevron}>▾</Text>
          </FluidPressable>

          {serviceInterval !== null && (
            <View style={styles.serviceBox}>
              {kmStand === null ? (
                <Text style={styles.serviceText}>{t('vehicles', 'serviceNoKmYet')}</Text>
              ) : (
                <>
                  <Text style={styles.serviceText}>
                    {`${t('vehicles', 'serviceDueAt')} ${formatKm(serviceDueAt ?? 0)}`}
                  </Text>
                  <Text
                    style={[
                      styles.serviceRemaining,
                      (serviceRemaining ?? 0) <= 0 && styles.serviceOverdue,
                    ]}
                  >
                    {(serviceRemaining ?? 0) <= 0
                      ? `${t('vehicles', 'serviceOverdue')} ${formatKm(Math.abs(serviceRemaining ?? 0))}`
                      : `${t('vehicles', 'serviceRemaining')} ${formatKm(serviceRemaining ?? 0)}`}
                  </Text>
                </>
              )}
            </View>
          )}

          <Text style={styles.hint}>{t('vehicles', 'serviceIntervalHint')}</Text>

          <FluidPressable
            style={[styles.saveButton, busy && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={busy}
          >
            {isSaving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.saveButtonText}>{t('vehicles', 'saveButton')}</Text>
            )}
          </FluidPressable>
        </View>

        {/* Nur wenn es etwas zu quittieren gibt: ohne Intervall oder ohne
            Kilometerstand aus der Tankliste wäre der Button wirkungslos. */}
        {serviceInterval !== null && kmStand !== null && (
          <FluidPressable
            style={[styles.serviceButton, busy && styles.buttonDisabled]}
            onPress={handleServiceDone}
            disabled={busy}
          >
            {isServicing ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.serviceButtonText}>
                {t('vehicles', 'serviceDoneButton')}
              </Text>
            )}
          </FluidPressable>
        )}

        <FluidPressable
          style={[styles.retireButton, busy && styles.buttonDisabled]}
          onPress={isRetired ? () => applyRetired(false) : handleRetire}
          disabled={busy}
        >
          {isRetiring ? (
            <ActivityIndicator color={c.tint} />
          ) : (
            <Text style={styles.retireButtonText}>
              {t('vehicles', isRetired ? 'reactivateButton' : 'retireButton')}
            </Text>
          )}
        </FluidPressable>
      </ScrollView>

      <Modal
        visible={isIntervalPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsIntervalPickerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurSurface
            intensity={30}
            tint="dark"
            fallbackColor="rgba(0,0,0,0.6)"
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('vehicles', 'serviceIntervalLabel')}</Text>
              <FluidPressable onPress={() => setIsIntervalPickerOpen(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </FluidPressable>
            </View>
            <FlatList
              data={SERVICE_INTERVAL_OPTIONS}
              keyExtractor={(item) => String(item)}
              ListHeaderComponent={
                // Überwachung wieder abschalten — etwa für einen Anhänger,
                // der keinen kilometerabhängigen Service hat.
                <FluidPressable
                  style={styles.pickerOption}
                  onPress={() => {
                    setServiceInterval(null);
                    setIsIntervalPickerOpen(false);
                  }}
                >
                  <Text style={styles.pickerOptionMuted}>
                    {t('vehicles', 'serviceIntervalNone')}
                  </Text>
                </FluidPressable>
              }
              renderItem={({ item }) => (
                <FluidPressable
                  style={styles.pickerOption}
                  onPress={() => {
                    setServiceInterval(item);
                    setIsIntervalPickerOpen(false);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{formatKm(item)}</Text>
                </FluidPressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c, scheme } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    container: u.screen,
    content: {
      flex: 1,
    },
    contentInner: u.narrowColumn,
    backButton: u.backButton,
    backButtonText: u.backButtonText,
    card: u.card,
    sectionTitle: {
      ...Typography.title3,
      marginBottom: Spacing.md,
      color: c.text,
    },
    label: {
      ...Typography.caption1,
      fontWeight: '600',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: Spacing.xs - 2,
    },
    readonlyField: {
      ...u.field,
      marginBottom: 0,
      backgroundColor: c.surfaceTertiary,
      borderColor: 'transparent',
    },
    readonlyValue: {
      ...Typography.body,
      fontWeight: '600',
      color: c.textSecondary,
    },
    hint: {
      ...u.hint,
      marginTop: Spacing.xs - 2,
      marginBottom: Spacing.md,
    },
    input: {
      ...u.input,
      marginBottom: Spacing.md,
      backgroundColor: c.surfaceSecondary,
      borderColor: 'transparent',
    },
    saveButton: {
      ...u.primaryButton,
      marginTop: Spacing.xs,
    },
    saveButtonText: u.primaryButtonText,
    buttonDisabled: u.disabled,
    retireButton: {
      ...u.tintedButton,
      marginTop: Spacing.md,
    },
    retireButtonText: u.tintedButtonText,
    sectionSubTitle: {
      ...u.sectionTitle,
      marginTop: Spacing.xs,
      paddingHorizontal: 0,
    },
    selectField: {
      ...u.field,
      marginBottom: 0,
      backgroundColor: c.surfaceSecondary,
      borderColor: 'transparent',
    },
    selectValue: u.fieldValue,
    selectPlaceholder: u.fieldPlaceholder,
    selectChevron: u.chevron,
    serviceBox: {
      backgroundColor: c.surfaceSecondary,
      borderRadius: Radius.md,
      padding: Spacing.sm,
      marginTop: Spacing.sm,
    },
    serviceText: {
      ...Typography.subhead,
      color: c.text,
      fontWeight: '600',
    },
    serviceRemaining: {
      ...Typography.subhead,
      color: c.textSecondary,
      marginTop: 2,
    },
    serviceOverdue: {
      color: c.danger,
      fontWeight: '700',
    },
    // Dunkelrot im Light Mode, dunkles Grau im Dark Mode — weißer Text bleibt lesbar
    serviceButton: {
      ...u.primaryButton,
      backgroundColor: scheme === 'dark' ? c.surfaceTertiary : Colors.ui.tertiary,
      marginTop: Spacing.md,
    },
    serviceButtonText: {
      ...u.primaryButtonText,
      color: '#FFFFFF',
    },
    modalOverlay: u.modalOverlay,
    modalContent: u.modalSheet,
    modalHeader: u.modalHeader,
    modalTitle: u.modalTitle,
    closeButton: u.closeButton,
    pickerOption: u.option,
    pickerOptionText: u.optionText,
    pickerOptionMuted: {
      ...u.optionText,
      color: c.textSecondary,
      fontStyle: 'italic',
    },
    retiredBanner: {
      backgroundColor: c.surfaceSecondary,
      borderRadius: Radius.md,
      padding: Spacing.sm,
      marginBottom: Spacing.md,
    },
    retiredBannerTitle: {
      ...Typography.subhead,
      fontWeight: '700',
      color: c.text,
      marginBottom: Spacing.xxs,
    },
    retiredBannerText: {
      ...Typography.footnote,
      color: c.textSecondary,
    },
  });
};
