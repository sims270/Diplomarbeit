import {
  deleteOrderDocument,
  getOrderDocumentDownloadUrl,
  listOrderDocuments,
  uploadOrderDocument,
  type OrderDocument,
} from '@/app/services/orderDocumentService';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Colors } from '@/constants/theme';
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
        <ActivityIndicator style={styles.loading} color={Colors.ui.primary} />
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
                <ActivityIndicator color={Colors.ui.primary} />
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

const styles = StyleSheet.create({
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.ui.charcoal,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  loading: {
    marginVertical: 12,
  },
  errorText: {
    fontSize: 13,
    color: Colors.ui.orange,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.ui.darkGray,
    marginBottom: 12,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  documentMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.ui.lightGray,
  },
  documentIcon: {
    fontSize: 18,
  },
  documentTexts: {
    flex: 1,
  },
  documentName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.charcoal,
  },
  documentMeta: {
    fontSize: 11,
    color: Colors.ui.darkGray,
  },
  downloadHint: {
    fontSize: 16,
    color: Colors.ui.primary,
    fontWeight: '700',
  },
  deleteButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.ui.lightGray,
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.ui.orange,
  },
  hintText: {
    fontSize: 11,
    color: Colors.ui.darkGray,
    marginBottom: 12,
  },
  uploadButton: {
    backgroundColor: Colors.ui.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  noteText: {
    fontSize: 11,
    color: Colors.ui.darkGray,
    marginTop: 12,
    lineHeight: 16,
  },
});
