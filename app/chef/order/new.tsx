import { useAuth } from '@/app/context/AuthContext';
import { getOrderPrice, saveOrderPrice } from '@/app/services/orderPriceService';
import { addOrder, getOrderById, type OrderFields } from '@/app/services/orderService';
import { OwnOrderForm } from '@/components/OwnOrderForm';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Spacing } from '@/constants/theme';
import { type AppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert } from '@/lib/alert';
import { loadDraft, newDraftKey } from '@/lib/orderDrafts';
import { describeSavedPdf } from '@/lib/orderPdfFile';
import { exportOwnOrderPdf } from '@/lib/ownOrderExport';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

/** Womit das Formular startet und unter welchem Schlüssel es sich merkt. */
interface StartValues {
  key: string;
  /** true = geöffneter Entwurf, bleibt auch ohne Änderung stehen. */
  keep: boolean;
  fields?: Partial<OrderFields>;
  price?: string;
  /** copyFrom und copyNr bei einer Kopie — für den Hinweis und die Entwurfsliste. */
  meta: Record<string, string>;
}

export default function NewOrderScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();

  // Drei Wege hierher:
  //   * "Neu":          leeres Formular, neuer Entwurf.
  //   * "Duplizieren":  ?copyFrom=<id> — alles aus dem Auftrag außer der
  //                     Transportnummer (vergibt die Datenbank neu) und dem,
  //                     was erst beim Fahren entsteht (Fahrer, Status,
  //                     Kilometer, Belege). Neuer Entwurf.
  //   * "Entwürfe":     ?draft=<Schlüssel> — der gemerkte Entwurf, er wird
  //                     unter demselben Schlüssel weitergeführt.
  // Jeder Weg hat seinen eigenen Entwurf (lib/orderDrafts.ts), es kann also
  // beliebig viele geben.
  const { copyFrom, draft } = useLocalSearchParams<{ copyFrom?: string; draft?: string }>();
  const [start, setStart] = useState<StartValues | undefined>(
    copyFrom || draft ? undefined : { key: newDraftKey('own'), keep: false, meta: {} }
  );

  useEffect(() => {
    let cancelled = false;
    if (draft) {
      loadDraft(draft).then((stored) => {
        if (cancelled) return;
        const value = (stored?.value ?? {}) as { form?: Partial<OrderFields>; price?: string };
        setStart({
          key: draft,
          keep: true,
          fields: value.form,
          price: value.price ?? '',
          meta: stored?.meta ?? {},
        });
      });
    } else if (copyFrom) {
      Promise.all([getOrderById(copyFrom), getOrderPrice(copyFrom)])
        .then(([source, price]) => {
          if (cancelled) return;
          if (!source) {
            setStart({ key: newDraftKey('own'), keep: false, meta: {} });
            return;
          }
          const { orderNr, ...rest } = source;
          setStart({
            key: newDraftKey('own'),
            keep: false,
            fields: { ...rest, orderNr: '' },
            price: price ?? '',
            meta: { copyFrom, copyNr: orderNr },
          });
        })
        .catch(() => !cancelled && setStart({ key: newDraftKey('own'), keep: false, meta: {} }));
    }
    return () => {
      cancelled = true;
    };
  }, [copyFrom, draft]);

  const handleCreate = async (fields: OrderFields, price: string) => {
    const order = await addOrder({ ...fields, createdBy: user?.id || '' });

    // Direkt nach dem Klick: Beim ersten Mal zeigt der Browser den
    // Ordner-Dialog, und das nur kurz nach einer Nutzeraktion. Der Preis
    // läuft deshalb parallel statt davor.
    const [, saved] = await Promise.all([
      saveOrderPrice(order.id, price),
      exportOwnOrderPdf(order),
    ]);
    if (saved) {
      showAlert(
        t('common', 'success'),
        describeSavedPdf(saved, t('orderPdf', 'savedToFolder'), t('orderPdf', 'downloaded'))
      );
    }
    router.back();
  };

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('chefOwnOrder', 'headerSubtitle')} code="CH" />

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
            <OwnOrderForm
              initialValues={start.fields}
              initialPrice={start.price ?? ''}
              submitLabel={t('chefOwnOrder', 'createButton')}
              onSubmit={handleCreate}
              draftKey={start.key}
              draftMeta={start.meta}
              draftKeepUnchanged={start.keep}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
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
  });
};
