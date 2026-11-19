import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuth } from '@/app/context/AuthContext';
import {
  assignOrder,
  checkNewAccess,
  createAccess,
  type ExternalAccess,
  getAccesses,
  suggestExpiresOn,
  suggestUsername,
  todayIso,
} from '@/app/services/externalDriverAccessService';
import {
  addExternalOrder,
  type ExternalOrderFields,
  getExternalOrderById,
} from '@/app/services/externalOrderService';
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
import { loadDraft, newDraftKey } from '@/lib/orderDrafts';
import { describeSavedPdf } from '@/lib/orderPdfFile';
import { exportTransportauftragPdf } from '@/lib/transportauftragExport';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

/** Womit das Formular startet und unter welchem Schlüssel es sich merkt. */
interface StartValues {
  key: string;
  /** true = geöffneter Entwurf, bleibt auch ohne Änderung stehen. */
  keep: boolean;
  fields?: Partial<ExternalOrderFields>;
  /** copyFrom und copyNr bei einer Kopie — für den Hinweis und die Entwurfsliste. */
  meta: Record<string, string>;
}

export default function NewExternalOrderScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();

  // Fahrer-Zugang: nur mit Häkchen. Ohne Häkchen entsteht kein Konto und
  // der Auftrag wird niemandem zugewiesen — genau wie bisher.
  const [assignAccess, setAssignAccess] = useState(false);
  const [allAccesses, setAllAccesses] = useState<ExternalAccess[]>([]);
  const [choice, setChoice] = useState('');
  // null = noch nicht angefasst: dann folgt der Name "An Firma" und das
  // Datum dem Entladedatum, auch wenn beide erst später eingetragen werden.
  const [label, setLabel] = useState<string | null>(null);
  // null = folgt dem Namen des Zugangs; sobald der Chef tippt, sein Wert.
  const [username, setUsername] = useState<string | null>(null);
  const [expiresOn, setExpiresOn] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<AccessCredentials | null>(null);

  useEffect(() => {
    getAccesses()
      .then(setAllAccesses)
      .catch(() => setAllAccesses([]));
  }, []);

  const activeAccesses = allAccesses.filter((access) => access.isActive);

  // Gibt es noch keinen gültigen Zugang, wird beim Speichern einer angelegt.
  const effectiveChoice = activeAccesses.length === 0 ? NEW_ACCESS : choice;
  const effectiveLabel = (fields: ExternalOrderFields) => label ?? fields.recipientCompany;
  const effectiveUsername = (fields: ExternalOrderFields) =>
    username ?? suggestUsername(effectiveLabel(fields));
  const effectiveExpiresOn = (fields: ExternalOrderFields) =>
    expiresOn ?? suggestExpiresOn(fields.unloadingDate);

  // Drei Wege hierher, wie beim eigenen Auftrag (app/chef/order/new.tsx):
  // "Neu", "Duplizieren" (?copyFrom=<id>) und "Entwürfe" (?draft=<Schlüssel>).
  // Bei der Kopie bleibt weg, was dem Frächter gehört: Kennzeichen, Fahrer,
  // Zugang, Bestätigung — und die Transportnummer (neu aus der Datenbank).
  const { copyFrom, draft } = useLocalSearchParams<{ copyFrom?: string; draft?: string }>();
  const [start, setStart] = useState<StartValues | undefined>(
    copyFrom || draft ? undefined : { key: newDraftKey('external'), keep: false, meta: {} }
  );

  useEffect(() => {
    let cancelled = false;
    if (draft) {
      loadDraft(draft).then((stored) => {
        if (cancelled) return;
        setStart({
          key: draft,
          keep: true,
          fields: (stored?.value ?? undefined) as Partial<ExternalOrderFields> | undefined,
          meta: stored?.meta ?? {},
        });
      });
    } else if (copyFrom) {
      getExternalOrderById(copyFrom)
        .then((source) => {
          if (cancelled) return;
          if (!source) {
            setStart({ key: newDraftKey('external'), keep: false, meta: {} });
            return;
          }
          const { orderNr, ...rest } = source;
          setStart({
            key: newDraftKey('external'),
            keep: false,
            fields: { ...rest, orderNr: '', licensePlate: '', driverName: '' },
            meta: { copyFrom, copyNr: orderNr },
          });
        })
        .catch(
          () => !cancelled && setStart({ key: newDraftKey('external'), keep: false, meta: {} })
        );
    }
    return () => {
      cancelled = true;
    };
  }, [copyFrom, draft]);

  const handleCreate = async (fields: ExternalOrderFields) => {
    // Alles, was den Zugang betrifft, vorher prüfen — ohne await, damit der
    // Klick für das PDF-Popup unten noch gilt.
    const accessLabel = effectiveLabel(fields).trim();
    const accessUsername = effectiveUsername(fields).trim();
    const accessExpiresOn = effectiveExpiresOn(fields);
    if (assignAccess) {
      if (!effectiveChoice) {
        throw new Error(t('externalAccess', 'alertChooseAccess'));
      }
      if (effectiveChoice === NEW_ACCESS) {
        if (!accessLabel) throw new Error(t('externalAccess', 'alertLabelRequired'));
        const { usernameProblem } = checkNewAccess(accessLabel, accessUsername, allAccesses);
        if (usernameProblem === 'invalid') throw new Error(t('externalAccess', 'usernameInvalid'));
        if (usernameProblem === 'taken') {
          throw new Error(
            t('externalAccess', 'usernameTaken').replace('{username}', accessUsername.toLowerCase())
          );
        }
        if (!accessExpiresOn) throw new Error(t('externalAccess', 'alertExpiresRequired'));
        if (accessExpiresOn < todayIso()) throw new Error(t('externalAccess', 'alertExpiresInPast'));
      }
    }

    const order = await addExternalOrder({ ...fields, createdBy: user?.id || '' });

    // Direkt nach dem Klick: Beim ersten Mal zeigt der Browser den
    // Ordner-Dialog, und das nur kurz nach einer Nutzeraktion.
    // addExternalOrder davor ist ein einzelnes, schnelles Insert.
    const saved = await exportTransportauftragPdf(order);
    if (saved) {
      showAlert(
        t('common', 'success'),
        describeSavedPdf(saved, t('orderPdf', 'savedToFolder'), t('orderPdf', 'downloaded'))
      );
    }

    // Der Zugang kommt erst nach dem PDF: Das Anlegen läuft über eine Edge
    // Function und dauert zu lange für den Ordner-Dialog.
    if (assignAccess) {
      try {
        if (effectiveChoice === NEW_ACCESS) {
          const created = await createAccess(accessLabel, accessUsername, accessExpiresOn);
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
        <MaterialIcons name={assignAccess ? 'check-box' : 'check-box-outline-blank'} style={styles.checkbox} />
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
            existingAccesses={allAccesses}
            label={effectiveLabel(fields)}
            onLabelChange={setLabel}
            username={effectiveUsername(fields)}
            onUsernameChange={setUsername}
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

        {start === undefined ? (
          <ActivityIndicator style={styles.loading} />
        ) : (
          <>
            {start.keep ? (
              <Text style={styles.copyHint}>{t('orderDraft', 'openedHint')}</Text>
            ) : start.meta.copyNr ? (
              <Text style={styles.copyHint}>
                {t('orderCopy', 'hint').replace('{orderNr}', start.meta.copyNr)}
              </Text>
            ) : null}
            <ExternalOrderForm
              initialValues={start.fields}
              submitLabel={t('chefExternalOrder', 'createButton')}
              onSubmit={handleCreate}
              draftKey={start.key}
              draftMeta={start.meta}
              draftKeepUnchanged={start.keep}
              renderBeforeSubmit={renderAccessSection}
            />
          </>
        )}
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
    loading: {
      marginTop: Spacing.xl,
    },
    copyHint: {
      ...u.hint,
      marginTop: 0,
      marginBottom: Spacing.md,
    },
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
