import {
  deleteOrderDocument,
  getOrderDocumentDownloadUrl,
  listOrderDocuments,
  uploadOrderDocument,
  type OrderDocument,
} from '@/app/services/orderDocumentService';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert, showConfirm } from '@/lib/alert';
import { timestampToGerman } from '@/lib/dateFormat';
import { openDownloadUrl } from '@/lib/download';
import { pickFile } from '@/lib/filePicker';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export interface OrderDocumentsProps {
  orderId: string;
  /** Fahrer-Ansicht: Datei auswählen und hochladen. */
  canUpload?: boolean;
  /** Nur solange der Auftrag offen ist — danach ist der Beleg fix. */
  canDelete?: boolean;
  /** Hinweiszeile unter der Liste, z. B. wann der Chef die Dateien sieht. */
  note?: string;
}


function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(fileName: string): boolean {
  return /\.(jpe?g|png|heic|heif|webp)$/i.test(fileName);
}

/**
 * Die CMR-/Foto-Liste eines Auftrags — dieselbe Komponente im Fahrer- wie im
 * Chef-Detail, nur mit anderen Rechten. Wer welche Datei überhaupt zu sehen
 * bekommt, entscheiden am Ende die Storage-Policies (siehe
 * supabase/migrations/20260908120000_order_documents.sql); die Props hier
 * steuern bloß, was die Oberfläche anbietet.
 */
export function OrderDocuments({
  orderId,
  canUpload = false,
  canDelete = false,
  note,
}: OrderDocumentsProps) {
  const styles = useThemedStyles(createStyles);
  const { c } = useAppTheme();
  const { t } = useTranslation();

  const [documents, setDocuments] = useState<OrderDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [busyPath, setBusyPath] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      setDocuments(await listOrderDocuments(orderId));
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = async () => {
    let picked;
    try {
      picked = await pickFile();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('orderDocuments', 'uploadFailed');
      showAlert(t('common', 'error'), message);
      return;
    }

    if (!picked) return;

    setIsUploading(true);
    try {
      await uploadOrderDocument(orderId, picked);
      await load();
      showAlert(t('common', 'success'), t('orderDocuments', 'uploadSuccess'));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('orderDocuments', 'uploadFailed');
      showAlert(t('common', 'error'), message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (doc: OrderDocument) => {
    setBusyPath(doc.path);
    try {
      await openDownloadUrl(await getOrderDocumentDownloadUrl(doc));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('orderDocuments', 'downloadFailed');
      showAlert(t('common', 'error'), message);
    } finally {
      setBusyPath(null);
    }
  };

  const handleDelete = (doc: OrderDocument) => {
    showConfirm(
      t('orderDocuments', 'deleteConfirmTitle'),
      `${doc.fileName} ${t('orderDocuments', 'deleteConfirmMessage')}`,
      async () => {
        setBusyPath(doc.path);
        try {
          await deleteOrderDocument(doc.path);
          await load();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : t('orderDocuments', 'deleteFailed');
          showAlert(t('common', 'error'), message);
        } finally {
          setBusyPath(null);
        }
      },
      {
        confirmText: t('orderDocuments', 'deleteButton'),
        cancelText: t('orderDocuments', 'deleteConfirmCancel'),
        destructive: true,
      }
    );
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('orderDocuments', 'title')}</Text>

      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={c.tint} />
      ) : loadError ? (
        <Text style={styles.errorText}>{t('orderDocuments', 'loadFailed')}</Text>
      ) : documents.length === 0 ? (
        <Text style={styles.emptyText}>
          {canUpload ? t('orderDocuments', 'empty') : t('orderDocuments', 'emptyReadOnly')}
        </Text>
      ) : (
        documents.map((doc) => (
          <View key={doc.path} style={styles.documentRow}>
            <FluidPressable
              style={styles.documentMain}
              onPress={() => handleDownload(doc)}
              disabled={busyPath === doc.path}
            >
              <Text style={styles.documentIcon}>{isImage(doc.fileName) ? '🖼️' : '📄'}</Text>
              <View style={styles.documentTexts}>
                <Text style={styles.documentName} numberOfLines={1}>
                  {doc.fileName}
                </Text>
                <Text style={styles.documentMeta}>
                  {formatSize(doc.sizeInBytes)}
                  {doc.uploadedAt ? ` · ${timestampToGerman(doc.uploadedAt)}` : ''}
                </Text>
              </View>
              {busyPath === doc.path ? (
                <ActivityIndicator color={c.tint} />
              ) : (
                <Text style={styles.downloadHint}>⬇</Text>
              )}
            </FluidPressable>

            {canDelete ? (
              <FluidPressable
                style={styles.deleteButton}
                onPress={() => handleDelete(doc)}
                disabled={busyPath === doc.path}
              >
                <Text style={styles.deleteButtonText}>{t('orderDocuments', 'deleteButton')}</Text>
              </FluidPressable>
            ) : null}
          </View>
        ))
      )}

      {documents.length > 0 ? (
        <Text style={styles.hintText}>{t('orderDocuments', 'downloadHint')}</Text>
      ) : null}

      {canUpload ? (
        <FluidPressable
          style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
          onPress={handleUpload}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.uploadButtonText}>{t('orderDocuments', 'uploadButton')}</Text>
          )}
        </FluidPressable>
      ) : null}

      {note ? <Text style={styles.noteText}>{note}</Text> : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    section: {
      ...u.card,
      marginBottom: Spacing.md,
    },
    sectionTitle: {
      ...Typography.title3,
      color: c.text,
      marginBottom: Spacing.sm,
    },
    loading: {
      marginVertical: Spacing.sm,
    },
    errorText: {
      ...Typography.subhead,
      color: c.danger,
      marginBottom: Spacing.sm,
    },
    emptyText: {
      ...Typography.subhead,
      color: c.textSecondary,
      marginBottom: Spacing.sm,
    },
    documentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginBottom: Spacing.xs,
    },
    documentMain: {
      flex: 1,
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      borderRadius: Radius.md,
      backgroundColor: c.surfaceSecondary,
    },
    documentIcon: {
      fontSize: 22,
    },
    documentTexts: {
      flex: 1,
    },
    documentName: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.text,
    },
    documentMeta: {
      ...Typography.caption1,
      color: c.textSecondary,
      marginTop: 2,
    },
    downloadHint: {
      ...Typography.headline,
      color: c.tint,
    },
    deleteButton: {
      minHeight: 56,
      minWidth: Layout.minTouch,
      justifyContent: 'center',
      paddingHorizontal: Spacing.sm,
      borderRadius: Radius.md,
      backgroundColor: c.dangerSoft,
    },
    deleteButtonText: {
      ...Typography.footnote,
      fontWeight: '600',
      color: c.danger,
    },
    hintText: {
      ...u.hint,
      marginTop: 0,
      marginBottom: Spacing.sm,
    },
    uploadButton: u.primaryButton,
    uploadButtonDisabled: u.disabled,
    uploadButtonText: u.primaryButtonText,
    noteText: {
      ...u.hint,
      marginTop: Spacing.sm,
    },
  });
};
