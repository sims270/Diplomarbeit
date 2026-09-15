import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { Layout, Radius, shadow, Spacing, Typography } from '@/constants/theme';
import type { AppTheme } from '@/hooks/use-app-theme';

/**
 * Wiederkehrende Grundformen im iOS-Stil. Die einzelnen Screens bauen ihre
 * StyleSheets daraus zusammen, damit Eingabefelder, Buttons, Karten und
 * Sheets überall gleich aussehen.
 */
export function uiStyles({ c, scheme, isTablet, isDesktop, columns, sideInset }: AppTheme) {
  const screen: ViewStyle = { flex: 1, backgroundColor: c.background };

  // Seitliche Abstände: Listen/Dashboards nutzen auf dem Laptop die volle
  // Breite bis 1280px (bündig mit dem Header), Formulare und Detailseiten
  // bis 1040px. Auf dem Tablet bleibt es bei einer lesbaren Spalte.
  const listInset = sideInset(isDesktop ? Layout.wideMaxWidth : Layout.contentMaxWidth);
  const formInset = sideInset(isDesktop ? Layout.formMaxWidth : Layout.contentMaxWidth);
  const narrowInset = sideInset(isDesktop ? 720 : Layout.contentMaxWidth);

  /** Inhaltsspalte für Listen und Dashboards */
  const column: ViewStyle = {
    width: '100%',
    paddingHorizontal: listInset,
    paddingTop: isDesktop ? Spacing.xl : isTablet ? Spacing.lg : Spacing.md,
    paddingBottom: Spacing.xxl,
  };
  const wideColumn: ViewStyle = column;
  /** Inhaltsspalte für Formulare und Detailseiten */
  const formColumn: ViewStyle = { ...column, paddingHorizontal: formInset };
  /** Schmale Spalte für kurze Einzelkarten-Formulare */
  const narrowColumn: ViewStyle = { ...column, paddingHorizontal: narrowInset };

  const largeTitle: TextStyle = {
    ...(isTablet ? Typography.largeTitle : Typography.title1),
    color: c.text,
  };

  /** Gruppierte Abschnittsüberschrift wie in den iOS-Einstellungen */
  const sectionTitle: TextStyle = {
    ...Typography.footnote,
    fontWeight: '600',
    color: c.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.xxs,
  };

  const card: ViewStyle = {
    backgroundColor: c.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...shadow(1, scheme),
  };

  const input: TextStyle = {
    ...Typography.body,
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.separator,
    backgroundColor: c.surface,
    color: c.text,
  };

  /** Tippbares Feld, das wie ein Eingabefeld aussieht (Datum, Auswahl) */
  const field: ViewStyle = {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.separator,
    backgroundColor: c.surface,
  };
  const fieldValue: TextStyle = { ...Typography.body, color: c.text, flexShrink: 1 };
  const fieldPlaceholder: TextStyle = { ...Typography.body, color: c.placeholder, flexShrink: 1 };
  const chevron: TextStyle = { ...Typography.callout, color: c.textTertiary };

  const primaryButton: ViewStyle = {
    minHeight: 52,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md + 2,
    backgroundColor: c.tintFill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
  };
  const primaryButtonText: TextStyle = { ...Typography.headline, color: c.onTint, textAlign: 'center' };

  /** Grau gefüllter Button für Nebenaktionen */
  const secondaryButton: ViewStyle = {
    ...primaryButton,
    backgroundColor: c.surfaceSecondary,
  };
  const secondaryButtonText: TextStyle = { ...Typography.headline, color: c.text, textAlign: 'center' };

  /** Rot getönter Button für zerstörende oder rote Nebenaktionen */
  const tintedButton: ViewStyle = { ...primaryButton, backgroundColor: c.tintSoft };
  const tintedButtonText: TextStyle = { ...Typography.headline, color: c.tint, textAlign: 'center' };

  /** Kleiner Pill-Button (z. B. „+ Neu“) */
  const smallButton: ViewStyle = {
    minHeight: Layout.minTouch,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: c.tintFill,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const smallButtonText: TextStyle = { ...Typography.subhead, fontWeight: '600', color: c.onTint };

  /** Text-Link-Button wie „‹ Zurück“ in iOS */
  const backButton: ViewStyle = {
    minHeight: Layout.minTouch,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingRight: Spacing.sm,
    marginBottom: Spacing.xs,
  };
  const backButtonText: TextStyle = { ...Typography.body, color: c.tint, fontWeight: '400' };

  const disabled: ViewStyle = { opacity: 0.5 };

  const badge: ViewStyle = {
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  };
  const badgeText: TextStyle = {
    ...Typography.caption2,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  };

  const emptyState: ViewStyle = {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    backgroundColor: c.surface,
  };
  const emptyStateText: TextStyle = { ...Typography.headline, color: c.text, marginBottom: Spacing.xxs, textAlign: 'center' };
  const emptyStateSubtext: TextStyle = { ...Typography.subhead, color: c.textSecondary, textAlign: 'center' };

  const errorText: TextStyle = { ...Typography.subhead, color: c.danger, textAlign: 'center', marginTop: Spacing.xl };

  // Bottom-Sheet
  const modalOverlay: ViewStyle = { flex: 1, justifyContent: 'flex-end' };
  const modalSheet: ViewStyle = {
    width: '100%',
    maxWidth: isDesktop ? 640 : Layout.contentMaxWidth,
    alignSelf: 'center',
    backgroundColor: c.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl + Spacing.xs,
    maxHeight: '80%',
    ...shadow(3, scheme),
  };
  const modalHeader: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  };
  const modalTitle: TextStyle = { ...Typography.title3, color: c.text, flexShrink: 1 };
  /** Runder grauer Schließen-Knopf, 44×44 */
  const closeButton: TextStyle = {
    width: Layout.minTouch,
    height: Layout.minTouch,
    lineHeight: Layout.minTouch,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: c.textSecondary,
    backgroundColor: c.surfaceSecondary,
    borderRadius: Layout.minTouch / 2,
    overflow: 'hidden',
  };
  const option: ViewStyle = {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.xs - 2,
    backgroundColor: c.surfaceSecondary,
  };
  const optionText: TextStyle = { ...Typography.callout, fontWeight: '600', color: c.text };
  const optionSubtext: TextStyle = { ...Typography.footnote, color: c.textSecondary, marginTop: 2 };

  /** Element außerhalb einer Scroll-Spalte, das trotzdem bündig mit ihr steht */
  const inset: ViewStyle = { marginHorizontal: listInset };
  const formInsetStyle: ViewStyle = { marginHorizontal: formInset };

  // Kartenraster für FlatList mit numColumns (Laptop: 2, großer Monitor: 3)
  const gridRow: ViewStyle = { gap: Spacing.sm };
  const gridItem: ViewStyle =
    columns > 1
      ? {
          flex: 1,
          // Eine allein stehende letzte Karte soll nicht über die ganze Zeile wachsen
          ...(Platform.OS === 'web'
            ? { maxWidth: `calc(${100 / columns}% - ${(Spacing.sm * (columns - 1)) / columns}px)` as unknown as number }
            : null),
        }
      : {};
  // Zwei Abschnitte nebeneinander (z. B. Ladung | Entladung) ab Laptop-Breite
  const pair: ViewStyle = isDesktop
    ? { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.lg }
    : {};
  const pairItem: ViewStyle = isDesktop ? { flex: 1, minWidth: 0 } : {};

  // iOS-Segmented-Control (ersetzt unterstrichene Reiter)
  const segmented: ViewStyle = {
    ...inset,
    flexDirection: 'row',
    padding: 2,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxs,
    borderRadius: Radius.sm + 2,
    backgroundColor: c.surfaceTertiary,
  };
  const segment: ViewStyle = {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.sm,
  };
  const segmentActive: ViewStyle = {
    backgroundColor: scheme === 'dark' ? c.surfaceSecondary : c.surface,
    ...shadow(1, scheme),
  };
  const segmentText: TextStyle = { ...Typography.subhead, fontWeight: '500', color: c.textSecondary };
  const segmentTextActive: TextStyle = { fontWeight: '600', color: c.text };

  const hint: TextStyle ={ ...Typography.footnote, color: c.textSecondary, marginTop: Spacing.xxs };
  const hairline: ViewStyle = { height: StyleSheet.hairlineWidth, backgroundColor: c.separator };

  return {
    screen,
    column,
    wideColumn,
    formColumn,
    narrowColumn,
    largeTitle,
    sectionTitle,
    card,
    input,
    field,
    fieldValue,
    fieldPlaceholder,
    chevron,
    primaryButton,
    primaryButtonText,
    secondaryButton,
    secondaryButtonText,
    tintedButton,
    tintedButtonText,
    smallButton,
    smallButtonText,
    backButton,
    backButtonText,
    disabled,
    badge,
    badgeText,
    emptyState,
    emptyStateText,
    emptyStateSubtext,
    errorText,
    modalOverlay,
    modalSheet,
    modalHeader,
    modalTitle,
    closeButton,
    option,
    optionText,
    optionSubtext,
    inset,
    formInset: formInsetStyle,
    gridRow,
    gridItem,
    pair,
    pairItem,
    segmented,
    segment,
    segmentActive,
    segmentText,
    segmentTextActive,
    hint,
    hairline,
  };
}
