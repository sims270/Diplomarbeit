import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert, showConfirm } from '@/lib/alert';
import {
  detectDocumentCorners,
  enhanceScan,
  loadScaledImage,
  type Point,
  type Quad,
  rotateQuad,
  SCAN_HEIGHT_PX,
  SCAN_WIDTH_PX,
  warpToA4,
} from '@/lib/documentScan';
import type { PickedFile } from '@/lib/filePickerShared';
import { canvasToJpeg, writePdf } from '@/lib/htmlToPdf';
import { type PointerEvent as ReactPointerEvent, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

export interface CmrScannerProps {
  visible: boolean;
  onCancel: () => void;
  /** Liefert das fertige PDF; hochgeladen wird in OrderDocuments. */
  onDone: (file: PickedFile) => void;
}

interface ScannedPage {
  jpeg: Uint8Array;
  previewUrl: string;
}

interface EditingPhoto {
  source: HTMLCanvasElement;
  previewUrl: string;
  quad: Quad;
}

// Etwas Qualität opfern: Ein CMR mit fünf Seiten soll keine 5 MB haben.
const SCAN_JPEG_QUALITY = 0.8;

/**
 * Wie lib/filePicker.web.ts, nur mit capture="environment": Am Handy öffnet
 * das direkt die Rückkamera, am PC den normalen Dateidialog.
 */
function takePhoto(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.style.display = 'none';
    document.body.appendChild(input);

    const finish = (file: File | null) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    input.click();
  });
}

// Die Bildberechnung blockiert den Browser kurz; vorher einmal Luft holen,
// damit der Ladekreis überhaupt gezeichnet wird.
function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 30));
}

function jpegUrl(jpeg: Uint8Array): string {
  return URL.createObjectURL(new Blob([jpeg as BlobPart], { type: 'image/jpeg' }));
}

function todayGerman(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${now.getFullYear()}`;
}

/**
 * Viereck über dem Foto mit vier ziehbaren Ecken. Gerechnet wird in
 * Pixeln des Fotos; das SVG liegt mit derselben viewBox darüber, die
 * Bildschirmposition wird beim Ziehen zurückgerechnet.
 */
function QuadEditor({
  previewUrl,
  width,
  height,
  quad,
  onChange,
  color,
}: {
  previewUrl: string;
  width: number;
  height: number;
  quad: Quad;
  onChange: (quad: Quad) => void;
  color: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragIndex = useRef<number | null>(null);

  const toImagePoint = (event: ReactPointerEvent): Point | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return {
      x: Math.min(Math.max(((event.clientX - rect.left) / rect.width) * width, 0), width),
      y: Math.min(Math.max(((event.clientY - rect.top) / rect.height) * height, 0), height),
    };
  };

  const moveCorner = (index: number, point: Point) => {
    const next = [...quad] as Quad;
    next[index] = point;
    onChange(next);
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = toImagePoint(event);
    if (!point) return;
    // Die nächstgelegene Ecke greifen — mit dem Finger trifft man den
    // Punkt selten genau.
    let nearest = 0;
    let nearestDistance = Infinity;
    quad.forEach((corner, index) => {
      const distance = Math.hypot(corner.x - point.x, corner.y - point.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = index;
      }
    });
    if (nearestDistance > Math.max(width, height) * 0.2) return;
    dragIndex.current = nearest;
    event.currentTarget.setPointerCapture(event.pointerId);
    moveCorner(nearest, point);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragIndex.current === null) return;
    const point = toImagePoint(event);
    if (point) moveCorner(dragIndex.current, point);
  };

  const stopDrag = () => {
    dragIndex.current = null;
  };

  const handleRadius = Math.max(width, height) * 0.025;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: `calc(60vh * ${width / height})`,
        aspectRatio: `${width} / ${height}`,
        margin: '0 auto',
      }}
    >
      <img
        src={previewUrl}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          borderRadius: Radius.sm,
          userSelect: 'none',
        }}
      />
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          touchAction: 'none',
          cursor: 'crosshair',
        }}
      >
        <polygon
          points={quad.map((p) => `${p.x},${p.y}`).join(' ')}
          fill={color}
          fillOpacity={0.15}
          stroke={color}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        {quad.map((p, index) => (
          <circle
            key={index}
            cx={p.x}
            cy={p.y}
            r={handleRadius}
            fill={color}
            fillOpacity={0.6}
            stroke="white"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}

/**
 * CMR-Scanner für den Web-Build: Seite fotografieren, Blatt wird erkannt
 * (lib/documentScan.ts), Ecken bei Bedarf nachziehen, gerade ziehen —
 * und am Ende alle Seiten als ein PDF zurückgeben. Die native App hat
 * dafür nur einen Platzhalter (CmrScanner.tsx).
 */
export function CmrScanner({ visible, onCancel, onDone }: CmrScannerProps) {
  const styles = useThemedStyles(createStyles);
  const { c } = useAppTheme();
  const { t } = useTranslation();

  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [editing, setEditing] = useState<EditingPhoto | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const reset = () => {
    pages.forEach((page) => URL.revokeObjectURL(page.previewUrl));
    if (editing) URL.revokeObjectURL(editing.previewUrl);
    setPages([]);
    setEditing(null);
    setIsBusy(false);
  };

  const fail = () => {
    setIsBusy(false);
    showAlert(t('common', 'error'), t('orderDocuments', 'scanFailed'));
  };

  const handleTakePhoto = async () => {
    const file = await takePhoto();
    if (!file) return;

    if (editing) URL.revokeObjectURL(editing.previewUrl);
    setEditing(null);
    setIsBusy(true);
    try {
      await nextFrame();
      const source = await loadScaledImage(file);
      const quad = detectDocumentCorners(source);
      // Vorschau aus dem verkleinerten Canvas: steht damit sicher richtig
      // herum, egal wie der Browser EXIF im <img> behandelt.
      const previewUrl = jpegUrl(canvasToJpeg(source, 0.85));
      setEditing({ source, previewUrl, quad });
      setIsBusy(false);
    } catch {
      fail();
    }
  };

  const handleApply = async () => {
    if (!editing) return;
    const current = editing;
    setIsBusy(true);
    try {
      await nextFrame();
      const page = warpToA4(current.source, current.quad);
      enhanceScan(page);
      const jpeg = canvasToJpeg(page, SCAN_JPEG_QUALITY);
      URL.revokeObjectURL(current.previewUrl);
      setPages((previous) => [...previous, { jpeg, previewUrl: jpegUrl(jpeg) }]);
      setEditing(null);
      setIsBusy(false);
    } catch {
      fail();
    }
  };

  const handleRemovePage = (index: number) => {
    setPages((previous) => {
      URL.revokeObjectURL(previous[index].previewUrl);
      return previous.filter((_, i) => i !== index);
    });
  };

  const handleUpload = () => {
    if (pages.length === 0) return;
    const blob = writePdf(
      pages.map((page) => page.jpeg),
      SCAN_WIDTH_PX,
      SCAN_HEIGHT_PX
    );
    const file: PickedFile = {
      name: `CMR-${todayGerman()}.pdf`,
      mimeType: 'application/pdf',
      uri: '',
      file: blob,
    };
    reset();
    onDone(file);
  };

  const handleCancel = () => {
    if (pages.length === 0 && !editing) {
      reset();
      onCancel();
      return;
    }
    showConfirm(
      t('orderDocuments', 'scanDiscardTitle'),
      t('orderDocuments', 'scanDiscardMessage'),
      () => {
        reset();
        onCancel();
      },
      {
        confirmText: t('orderDocuments', 'scanDiscardConfirm'),
        cancelText: t('orderDocuments', 'scanCancel'),
        destructive: true,
      }
    );
  };

  const renderContent = () => {
    if (isBusy) {
      return (
        <View style={styles.busy}>
          <ActivityIndicator color={c.tint} size="large" />
          <Text style={styles.hint}>{t('orderDocuments', 'scanProcessing')}</Text>
        </View>
      );
    }

    if (editing) {
      return (
        <>
          <Text style={styles.hint}>{t('orderDocuments', 'scanAdjustHint')}</Text>
          <View style={styles.editor}>
            <QuadEditor
              previewUrl={editing.previewUrl}
              width={editing.source.width}
              height={editing.source.height}
              quad={editing.quad}
              onChange={(quad) => setEditing({ ...editing, quad })}
              color={c.tint}
            />
          </View>
          <View style={styles.buttonRow}>
            <FluidPressable
              style={[styles.secondaryButton, styles.flexButton]}
              onPress={() => setEditing({ ...editing, quad: rotateQuad(editing.quad) })}
            >
              <Text style={styles.secondaryButtonText}>{t('orderDocuments', 'scanRotate')}</Text>
            </FluidPressable>
            <FluidPressable
              style={[styles.secondaryButton, styles.flexButton]}
              onPress={handleTakePhoto}
            >
              <Text style={styles.secondaryButtonText}>{t('orderDocuments', 'scanRetake')}</Text>
            </FluidPressable>
          </View>
          <FluidPressable style={styles.primaryButton} onPress={handleApply}>
            <Text style={styles.primaryButtonText}>{t('orderDocuments', 'scanApply')}</Text>
          </FluidPressable>
        </>
      );
    }

    return (
      <>
        {pages.length === 0 ? (
          <Text style={styles.hint}>{t('orderDocuments', 'scanNoPages')}</Text>
        ) : (
          <View style={styles.pageGrid}>
            {pages.map((page, index) => (
              <View key={page.previewUrl} style={styles.pageItem}>
                <img
                  src={page.previewUrl}
                  alt=""
                  style={{
                    width: '100%',
                    aspectRatio: `${SCAN_WIDTH_PX} / ${SCAN_HEIGHT_PX}`,
                    borderRadius: Radius.sm,
                    border: `1px solid ${c.separator}`,
                    display: 'block',
                  }}
                />
                <Text style={styles.pageLabel}>
                  {t('orderDocuments', 'scanPageLabel')} {index + 1}
                </Text>
                <FluidPressable style={styles.removeButton} onPress={() => handleRemovePage(index)}>
                  <Text style={styles.removeButtonText}>{t('orderDocuments', 'scanRemovePage')}</Text>
                </FluidPressable>
              </View>
            ))}
          </View>
        )}

        <FluidPressable
          style={pages.length === 0 ? styles.primaryButton : styles.secondaryButton}
          onPress={handleTakePhoto}
        >
          <Text style={pages.length === 0 ? styles.primaryButtonText : styles.secondaryButtonText}>
            {pages.length === 0 ? t('orderDocuments', 'scanTakePhoto') : t('orderDocuments', 'scanAddPage')}
          </Text>
        </FluidPressable>

        {pages.length > 0 ? (
          <FluidPressable style={styles.primaryButton} onPress={handleUpload}>
            <Text style={styles.primaryButtonText}>{t('orderDocuments', 'scanUpload')}</Text>
          </FluidPressable>
        ) : null}
      </>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleCancel}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('orderDocuments', 'scanTitle')}</Text>
          <FluidPressable style={styles.cancelButton} onPress={handleCancel} disabled={isBusy}>
            <Text style={styles.cancelButtonText}>{t('orderDocuments', 'scanCancel')}</Text>
          </FluidPressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>{renderContent()}</ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xs,
      width: '100%',
      maxWidth: 760,
      alignSelf: 'center',
    },
    title: {
      ...Typography.title3,
      color: c.text,
    },
    cancelButton: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: Spacing.xs,
    },
    cancelButtonText: {
      ...Typography.headline,
      color: c.tint,
    },
    content: {
      padding: Spacing.md,
      gap: Spacing.sm,
      width: '100%',
      maxWidth: 760,
      alignSelf: 'center',
    },
    busy: {
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.xxl,
    },
    hint: {
      ...Typography.subhead,
      color: c.textSecondary,
      textAlign: 'center',
    },
    editor: {
      width: '100%',
    },
    buttonRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    flexButton: {
      flex: 1,
    },
    primaryButton: u.primaryButton,
    primaryButtonText: u.primaryButtonText,
    secondaryButton: u.secondaryButton,
    secondaryButtonText: u.secondaryButtonText,
    pageGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    pageItem: {
      width: 110,
      gap: Spacing.xxs,
    },
    pageLabel: {
      ...Typography.caption1,
      color: c.textSecondary,
      textAlign: 'center',
    },
    removeButton: {
      minHeight: 36,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: Radius.md,
      backgroundColor: c.dangerSoft,
    },
    removeButtonText: {
      ...Typography.footnote,
      fontWeight: '600',
      color: c.danger,
    },
  });
};
