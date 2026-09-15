import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import { Colors, Layout, type ThemeColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface AppTheme {
  scheme: 'light' | 'dark';
  c: ThemeColors;
  /** Fensterbreite in px */
  width: number;
  /** ≥ 768px */
  isTablet: boolean;
  /** ≥ 1024px (Laptop/Browser) */
  isDesktop: boolean;
  /** Seitlicher Mindestabstand je nach Bildschirmbreite */
  gutter: number;
  /** Spalten für Kartenraster: 1 (Handy/Tablet), 2 (Laptop), 3 (großer Monitor) */
  columns: 1 | 2 | 3;
  /**
   * Seitlicher Abstand, damit Inhalt mit maximaler Breite `maxWidth` mittig
   * steht — Header und Inhalt nutzen denselben Wert und fluchten dadurch.
   */
  sideInset: (maxWidth: number) => number;
}

/** Aktuelles Farbschema plus Breakpoints — rein für die Darstellung. */
export function useAppTheme(): AppTheme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { width } = useWindowDimensions();
  const isTablet = width >= Layout.tabletBreakpoint;
  const isDesktop = width >= Layout.desktopBreakpoint;

  return useMemo(() => {
    const gutter = isDesktop ? 40 : isTablet ? 32 : 16;
    const columns: 1 | 2 | 3 = width >= Layout.wideBreakpoint ? 3 : isDesktop ? 2 : 1;
    return {
      scheme,
      c: Colors[scheme],
      width,
      isTablet,
      isDesktop,
      gutter,
      columns,
      sideInset: (maxWidth: number) => Math.max(gutter, Math.round((width - maxWidth) / 2) + gutter),
    };
  }, [scheme, width, isTablet, isDesktop]);
}

/**
 * Erzeugt ein StyleSheet abhängig von Farbschema und Fensterbreite. Die
 * Styles werden nur neu berechnet, wenn sich eines davon ändert.
 *
 *   const createStyles = ({ c }: AppTheme) => StyleSheet.create({ ... });
 *   const styles = useThemedStyles(createStyles);
 */
export function useThemedStyles<T>(factory: (theme: AppTheme) => T): T {
  const theme = useAppTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
