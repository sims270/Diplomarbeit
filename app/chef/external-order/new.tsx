import { useAuth } from '@/app/context/AuthContext';
import {
  assignOrder,
  createAccess,
  type ExternalAccess,
  getAccesses,
  suggestExpiresOn,
  todayIso,
} from '@/app/services/externalDriverAccessService';
import { addExternalOrder, type ExternalOrderFields } from '@/app/services/externalOrderService';
import { type AccessCredentials, AccessCredentialsModal } from '@/components/AccessCredentialsModal';
import { ExternalAccessChooser, NEW_ACCESS } from '@/components/ExternalAccessChooser';
import { ExternalOrderForm } from '@/components/ExternalOrderForm';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert } from '@/lib/alert';
import { exportTransportauftragPdf } from '@/lib/transportauftragExport';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function NewExternalOrderScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();

  // Fahrer-Zugang: nur mit Häkchen. Ohne Häkchen entsteht kein Konto und
  // der Auftrag wird niemandem zugewiesen — genau wie bisher.
  const [assignAccess, setAssignAccess] = useState(false);
  const [activeAccesses, setActiveAccesses] = useState<ExternalAccess[]>([]);
  const [choice, setChoice] = useState('');
  // null = noch nicht angefasst: dann folgt der Name "An Firma" und das
  // Datum dem Entladedatum, auch wenn beide erst später eingetragen werden.
  const [label, setLabel] = useState<string | null>(null);
  const [expiresOn, setExpiresOn] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<AccessCredentials | null>(null);

  useEffect(() => {
    getAccesses()
      .then((accesses) => setActiveAccesses(accesses.filter((access) => access.isActive)))
      .catch(() => setActiveAccesses([]));
  }, []);

  // Gibt es noch keinen gültigen Zugang, wird beim Speichern einer angelegt.
  const effectiveChoice = activeAccesses.length === 0 ? NEW_ACCESS : choice;
  const effectiveLabel = (fields: ExternalOrderFields) => label ?? fields.recipientCompany;
  const effectiveExpiresOn = (fields: ExternalOrderFields) =>
    expiresOn ?? suggestExpiresOn(fields.unloadingDate);

  const handleCreate = async (fields: ExternalOrderFields) => {
    // Alles, was den Zugang betrifft, vorher prüfen — ohne await, damit der
    // Klick für das PDF-Popup unten noch gilt.
    const accessLabel = effectiveLabel(fields).trim();
    const accessExpiresOn = effectiveExpiresOn(fields);
    if (assignAccess) {
      if (!effectiveChoice) {
        throw new Error(t('externalAccess', 'alertChooseAccess'));
      }
      if (effectiveChoice === NEW_ACCESS) {
        if (!accessLabel) throw new Error(t('externalAccess', 'alertLabelRequired'));
        if (!accessExpiresOn) throw new Error(t('externalAccess', 'alertExpiresRequired'));
        if (accessExpiresOn < todayIso()) throw new Error(t('externalAccess', 'alertExpiresInPast'));
      }
    }

    const order = await addExternalOrder({ ...fields, createdBy: user?.id || '' });

    // Must run right after the click with no awaits ahead of it — on web
    // this opens a popup window, and browsers silently block window.open
    // once the "recent user gesture" allowance from the click has lapsed.
    // addExternalOrder above is a single fast insert, so it stays within
    // that window.
    await exportTransportauftragPdf(order);

    // Der Zugang kommt erst nach dem PDF: Das Anlegen läuft über eine Edge
    // Function und dauert zu lange für das Popup.
    if (assignAccess) {
      try {
        if (effectiveChoice === NEW_ACCESS) {
          const created = await createAccess(accessLabel, accessExpiresOn);
          await assignOrder(order.id, created.userId);
          // Zurück geht es erst, wenn der Chef die Zugangsdaten gesehen hat.
          setCredentials(created);
          return;
        }
        await assignOrder(order.id, effectiveChoice);
      } catch (error) {
        // Der Auftrag steht schon. Nicht auf diesem Bildschirm bleiben —
        // ein zweites Speichern legte ihn doppelt an.
        const message = error instanceof Error ? `\n\n${error.message}` : '';
        showAlert(t('common', 'error'), `${t('externalAccess', 'orderSavedAccessFailed')}${message}`);
      }
    }

    router.back();
  };

  const renderAccessSection = (fields: ExternalOrderFields) => (
    <View>
      <Text style={styles.sectionTitle}>{t('externalAccess', 'sectionTitle')}</Text>
      <FluidPressable style={styles.checkboxRow} onPress={() => setAssignAccess((prev) => !prev)}>
        <Text style={styles.checkbox}>{assignAccess ? '☑' : '☐'}</Text>
        <Text style={styles.checkboxText}>{t('externalAccess', 'assignCheckbox')}</Text>
      </FluidPressable>

      {assignAccess ? (
        <>
          <Text style={styles.hint}>
            {activeAccesses.length === 0
              ? t('externalAccess', 'noActiveAccess')
              : t('externalAccess', 'assignHint')}
          </Text>
          <ExternalAccessChooser
            accesses={activeAccesses}
            choice={effectiveChoice}
            onChoiceChange={setChoice}
            label={effectiveLabel(fields)}
            onLabelChange={setLabel}
            expiresOn={effectiveExpiresOn(fields)}
            onExpiresOnChange={setExpiresOn}
          />
        </>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('chefExternalOrder', 'headerSubtitle')} code="CH" />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <FluidPressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>

        <ExternalOrderForm
          submitLabel={t('chefExternalOrder', 'createButton')}
          onSubmit={handleCreate}
          renderBeforeSubmit={renderAccessSection}
        />
      </ScrollView>

      <AccessCredentialsModal
        credentials={credentials}
        onClose={() => {
          setCredentials(null);
          router.back();
        }}
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    container: u.screen,
    content: {
      flex: 1,
    },
    contentInner: {
      ...u.formColumn,
      paddingBottom: Spacing.xxl,
    },
    backButton: u.backButton,
    backButtonText: u.backButtonText,
    sectionTitle: u.sectionTitle,
    checkboxRow: {
      ...u.field,
      justifyContent: 'flex-start',
    },
    checkbox: {
      fontSize: 20,
      color: c.tint,
    },
    checkboxText: {
      ...Typography.body,
      color: c.text,
      flexShrink: 1,
    },
    hint: {
      ...u.hint,
      marginTop: 0,
      marginBottom: Spacing.xs,
      paddingHorizontal: Spacing.xxs,
    },
  });
};
