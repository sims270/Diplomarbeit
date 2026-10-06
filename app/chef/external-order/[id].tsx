import {
  type ExternalOrder,
  type ExternalOrderFields,
  getExternalOrderById,
  markExternalOrderCompleted,
  updateExternalOrder,
} from '@/app/services/externalOrderService';
import { ExternalAccessPanel } from '@/components/ExternalAccessPanel';
import { ExternalOrderForm } from '@/components/ExternalOrderForm';
import { billingCompanyOf } from '@/app/services/invoiceService';
import { InvoiceForm } from '@/components/InvoiceForm';
import { OrderDocuments } from '@/components/OrderDocuments';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Layout, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert, showConfirm } from '@/lib/alert';
import { timestampToGerman } from '@/lib/dateFormat';
import { exportTransportauftragPdf } from '@/lib/transportauftragExport';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function EditExternalOrderScreen() {
  const styles = useThemedStyles(createStyles);
  const { c } = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [order, setOrder] = useState<ExternalOrder | undefined | null>(undefined);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    getExternalOrderById(id)
      .then((found) => setOrder(found ?? null))
      .catch(() => setOrder(null));
  }, [id]);

  const handleUpdate = async (fields: ExternalOrderFields) => {
    const updated = await updateExternalOrder(id, fields);

    // Same reasoning as the create screen: keep this right after the click
    // with nothing awaited ahead of it, so web's popup permission holds.
    await exportTransportauftragPdf(updated);
    router.back();
  };

  // Für Frachtführer ohne App-Zugang: Sonst bliebe der Fremdauftrag für
  // immer offen und ließe sich nie verrechnen.
  const handleComplete = () => {
    if (!order) return;
    showConfirm(
      t('chefExternalOrder', 'completeConfirmTitle'),
      `Nr. ${order.orderNr} ${t('chefExternalOrder', 'completeConfirmMessage')}`,
      async () => {
        setIsCompleting(true);
        try {
          setOrder(await markExternalOrderCompleted(order.id));
        } catch (error) {
          showAlert(
            t('common', 'error'),
            error instanceof Error ? error.message : t('chefExternalOrder', 'completeFailed')
          );
        } finally {
          setIsCompleting(false);
        }
      },
      {
        confirmText: t('chefExternalOrder', 'completeConfirmButton'),
        cancelText: t('common', 'cancel'),
      }
    );
  };

  if (order === undefined) {
    return (
      <View style={styles.container}>
        <Header title="TRANSLOG PRO" subtitle={t('chefExternalOrder', 'editHeaderSubtitle')} code="CH" />
        <ActivityIndicator style={styles.loading} color={c.tint} />
      </View>
    );
  }

  if (order === null) {
    return (
      <View style={styles.container}>
        <Header title="TRANSLOG PRO" subtitle={t('chefExternalOrder', 'editHeaderSubtitle')} code="CH" />
        <View style={styles.content}>
          <FluidPressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
          </FluidPressable>
          <Text style={styles.errorText}>{t('chefExternalOrder', 'notFound')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('chefExternalOrder', 'editHeaderSubtitle')} code="CH" />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <FluidPressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('chefExternalOrder', 'statusSection')}</Text>
          {order.status === 'completed' ? (
            <View style={styles.row}>
              <Text style={styles.label}>{t('chefExternalOrder', 'completedAtLabel')}</Text>
              <Text style={styles.completedValue}>
                ✓ {order.completedAt ? timestampToGerman(order.completedAt) : t('chefExternalOrder', 'statusCompleted')}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>{t('chefExternalOrder', 'statusSection')}</Text>
                <Text style={styles.value}>{t('chefExternalOrder', 'statusPending')}</Text>
              </View>
              <FluidPressable
                style={[styles.completeButton, isCompleting && styles.buttonDisabled]}
                onPress={handleComplete}
                disabled={isCompleting}
              >
                {isCompleting ? (
                  <ActivityIndicator color={c.tint} />
                ) : (
                  <Text style={styles.completeButtonText}>
                    {t('chefExternalOrder', 'completeButton')}
                  </Text>
                )}
              </FluidPressable>
              <Text style={styles.hint}>{t('chefExternalOrder', 'completeHint')}</Text>
            </>
          )}
        </View>

        {/* Wie beim eigenen Auftrag: abgerechnet wird, was gefahren wurde.
            Empfänger ist die Firma, von der der Auftrag kommt — nicht der
            fremde Frachtführer, den bezahlt die Firma. */}
        {order.status === 'completed' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('chefInvoice', 'title')}</Text>
            <Text style={styles.hint}>{t('chefExternalOrder', 'invoiceHint')}</Text>
            <InvoiceForm
              orderId={order.id}
              orderNr={order.orderNr}
              billingCompany={billingCompanyOf(order)}
            />
          </View>
        ) : null}

        <ExternalOrderForm
          initialValues={order}
          submitLabel={t('chefExternalOrder', 'saveButton')}
          onSubmit={handleUpdate}
        />

        {/* Unabhängig vom Formular: Zuweisen, Verlängern und Löschen wirken
            sofort, nicht erst mit "Änderungen speichern". */}
        <ExternalAccessPanel
          orderId={order.id}
          recipientCompany={order.recipientCompany}
          unloadingDate={order.unloadingDate}
        />

        <OrderDocuments orderId={order.id} note={t('externalAccess', 'documentsNote')} />
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    // Wie die Abschnitte in app/chef/order/[id].tsx.
    section: {
      ...u.card,
      marginBottom: Spacing.md,
    },
    sectionTitle: {
      ...Typography.title3,
      color: c.text,
      marginBottom: Spacing.xs,
    },
    row: {
      minHeight: Layout.minTouch,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.md,
    },
    label: {
      ...Typography.subhead,
      color: c.textSecondary,
    },
    value: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.text,
    },
    completedValue: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.success,
      flexShrink: 1,
    },
    completeButton: {
      ...u.tintedButton,
      marginTop: Spacing.sm,
    },
    completeButtonText: u.tintedButtonText,
    buttonDisabled: u.disabled,
    hint: {
      ...u.hint,
      marginTop: Spacing.xs,
      marginBottom: Spacing.xs,
    },
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
    loading: {
      marginTop: Spacing.xl,
    },
    errorText: u.errorText,
  });
};
