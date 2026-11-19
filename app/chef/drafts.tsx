import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Layout, Spacing, Typography } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import { showConfirm } from '@/lib/alert';
import { isoToGerman, timestampToGerman } from '@/lib/dateFormat';
import { type DraftKind, deleteDraft, listDrafts, type StoredDraft } from '@/lib/orderDrafts';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

/** Die Felder, die in der Liste gezeigt werden — bei beiden Auftragsarten gleich benannt. */
interface DraftFields {
  loadingCompany?: string;
  unloadingCompany?: string;
  loadingDate?: string;
  recipientCompany?: string;
}

function fieldsOf(draft: StoredDraft): DraftFields {
  const value = (draft.value ?? {}) as { form?: DraftFields } & DraftFields;
  // Eigener Auftrag: { form, price }; Fremdauftrag: die Felder direkt.
  return draft.kind === 'own' ? value.form ?? {} : value;
}

/**
 * Alle noch nicht gespeicherten Aufträge auf diesem Gerät — neue und
 * duplizierte, die der Chef vor dem Speichern verlassen hat
 * (lib/orderDrafts.ts). Antippen öffnet den Entwurf zum Weiterbearbeiten,
 * "Löschen" verwirft ihn.
 *
 * ?kind=own bzw. ?kind=external zeigt nur eine Art — so kommt man von der
 * jeweiligen Auftragsliste her. Ohne kind alle.
 */
export default function DraftsScreen() {
  const styles = useThemedStyles(createStyles);
  const { c } = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { kind } = useLocalSearchParams<{ kind?: DraftKind }>();
  const [drafts, setDrafts] = useState<StoredDraft[] | null>(null);

  const load = useCallback(async () => {
    const all = await listDrafts();
    setDrafts(kind ? all.filter((draft) => draft.kind === kind) : all);
  }, [kind]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const open = (draft: StoredDraft) =>
    router.push(
      draft.kind === 'own'
        ? { pathname: '/chef/order/new', params: { draft: draft.key } }
        : { pathname: '/chef/external-order/new', params: { draft: draft.key } }
    );

  const remove = (draft: StoredDraft) =>
    showConfirm(
      t('orderDraft', 'deleteConfirmTitle'),
      t('orderDraft', 'deleteConfirmMessage'),
      async () => {
        await deleteDraft(draft.key);
        await load();
      },
      {
        confirmText: t('orderDraft', 'deleteConfirm'),
        cancelText: t('common', 'cancel'),
        destructive: true,
      }
    );

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('orderDraft', 'headerSubtitle')} code="CH" />

      <ScrollView contentContainerStyle={styles.content}>
        <FluidPressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>

        <Text style={styles.sectionTitle}>
          {t('orderDraft', 'title')}
          {drafts ? ` (${drafts.length})` : ''}
        </Text>
        <Text style={styles.hint}>{t('orderDraft', 'pageHint')}</Text>

        {drafts === null ? (
          <ActivityIndicator style={styles.loading} color={c.tint} />
        ) : drafts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{t('orderDraft', 'empty')}</Text>
          </View>
        ) : (
          drafts.map((draft) => {
            const fields = fieldsOf(draft);
            const route = [fields.loadingCompany, fields.unloadingCompany]
              .map((part) => part?.trim())
              .filter(Boolean)
              .join(' → ');
            return (
              <View key={draft.key} style={styles.card}>
                <FluidPressable style={styles.cardMain} onPress={() => open(draft)}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.kind}>
                      {t('orderDraft', draft.kind === 'own' ? 'kindOwn' : 'kindExternal')}
                    </Text>
                    {draft.meta.copyNr ? (
                      <Text style={styles.copyOf}>
                        {t('orderDraft', 'copyOf').replace('{orderNr}', draft.meta.copyNr)}
                      </Text>
                    ) : null}
                  </View>
                  {draft.kind === 'external' && fields.recipientCompany ? (
                    <Text style={styles.line}>{fields.recipientCompany}</Text>
                  ) : null}
                  <Text style={styles.route}>{route || t('orderDraft', 'noDetails')}</Text>
                  <Text style={styles.meta}>
                    {[
                      fields.loadingDate ? isoToGerman(fields.loadingDate) : null,
                      draft.savedAt
                        ? t('orderDraft', 'savedAt').replace('{date}', timestampToGerman(draft.savedAt))
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </FluidPressable>
                <FluidPressable style={styles.deleteButton} onPress={() => remove(draft)}>
                  <MaterialIcons name="delete-outline" size={18} color={c.danger} />
                  <Text style={styles.deleteText}>{t('orderDraft', 'delete')}</Text>
                </FluidPressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    container: u.screen,
    content: {
      ...u.formColumn,
      paddingBottom: Spacing.xxl,
    },
    backButton: u.backButton,
    backButtonText: u.backButtonText,
    sectionTitle: {
      ...u.sectionTitle,
      marginTop: 0,
    },
    hint: {
      ...u.hint,
      marginTop: 0,
      marginBottom: Spacing.md,
    },
    loading: {
      marginTop: Spacing.xl,
    },
    emptyState: u.emptyState,
    emptyStateText: u.emptyStateText,
    card: {
      ...u.card,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    cardMain: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    kind: {
      ...Typography.headline,
      color: c.text,
    },
    copyOf: {
      ...Typography.footnote,
      color: c.tint,
      fontWeight: '600',
    },
    line: {
      ...Typography.subhead,
      color: c.text,
    },
    route: {
      ...Typography.subhead,
      color: c.text,
    },
    meta: {
      ...Typography.footnote,
      color: c.textSecondary,
    },
    deleteButton: {
      minHeight: Layout.minTouch,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xxs,
      paddingHorizontal: Spacing.sm,
      borderRadius: 999,
      backgroundColor: c.dangerSoft,
    },
    deleteText: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.danger,
    },
  });
};
