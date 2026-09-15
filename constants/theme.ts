/**
 * Design-Tokens der App im Stil der Apple Human Interface Guidelines.
 *
 * Palette bewusst reduziert: Rot als Akzent, Grau in Abstufungen, Weiß und
 * Schwarz. Einzige Ausnahme ist Grün für den Status ABGESCHLOSSEN.
 *
 * Alle Kontraste sind auf WCAG AA (≥ 4.5:1 für Fließtext) geprüft — deshalb
 * gibt es im Dark Mode zwei Rottöne: `tint` für roten Text/Icons auf dunklem
 * Grund und `tintFill` für Flächen, auf denen weißer Text steht.
 */

import { Platform, type TextStyle, type ViewStyle } from 'react-native';

// Corporate-Rot RAL 3002 und seine Varianten
const primary = '#9b2321';
const tertiary = '#660000';
const darkModeRed = '#F2555A'; // roter Text auf dunklem Grund (5.3:1 auf #1C1C1E)
const darkModeRedFill = '#C62F33'; // rote Fläche mit weißem Text (5.6:1)

const darkGray = '#5E5E5E';
const lightGray = '#F2F2F2';
const charcoal = '#1A1A1A';
const white = '#FFFFFF';

// Status: OFFEN Rot, UNTERWEGS Grau, ABGESCHLOSSEN Grün — alle mit weißem
// Badge-Text AA-konform.
const statusOpen = primary;
const statusTransit = '#666666';
const statusDone = '#1E7B45';

const light = {
  // bestehende Schlüssel (werden von useThemeColor & Navigation genutzt)
  text: '#111111',
  background: '#F2F2F2',
  border: '#D9D9D9',
  tint: primary,
  icon: darkGray,
  tabIconDefault: '#6E6E6E',
  tabIconSelected: primary,

  // semantische Farben
  surface: white,
  surfaceSecondary: '#F2F2F2',
  surfaceTertiary: '#E8E8E8',
  textSecondary: '#5E5E5E',
  textTertiary: '#6E6E6E',
  placeholder: '#8A8A8A',
  separator: '#E3E3E3',
  tintFill: primary,
  tintSoft: 'rgba(155, 35, 33, 0.10)',
  onTint: white,
  success: statusDone,
  successSoft: 'rgba(30, 123, 69, 0.12)',
  danger: primary,
  dangerSoft: 'rgba(155, 35, 33, 0.10)',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.4)',
  bar: 'rgba(249, 249, 249, 0.86)',
  barSolid: '#F9F9F9',
};

const dark: typeof light = {
  text: '#FFFFFF',
  background: '#000000',
  border: '#3A3A3A',
  tint: darkModeRed,
  icon: '#ABABAB',
  tabIconDefault: '#8E8E8E',
  tabIconSelected: darkModeRed,

  surface: '#1C1C1E',
  surfaceSecondary: '#2C2C2E',
  surfaceTertiary: '#3A3A3C',
  textSecondary: '#ABABAB',
  textTertiary: '#8E8E8E',
  placeholder: '#7A7A7A',
  separator: '#38383A',
  tintFill: darkModeRedFill,
  tintSoft: 'rgba(242, 85, 90, 0.16)',
  onTint: white,
  success: '#4CC27A',
  successSoft: 'rgba(76, 194, 122, 0.16)',
  danger: darkModeRed,
  dangerSoft: 'rgba(242, 85, 90, 0.16)',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.6)',
  bar: 'rgba(22, 22, 23, 0.82)',
  barSolid: '#161617',
};

export type ThemeColors = typeof light;

export const Colors = {
  light,
  dark,
  status: {
    offen: statusOpen,
    unterwegs: statusTransit,
    erledigt: statusDone,
  },
  ui: {
    primary,
    secondary: darkGray,
    tertiary,
    // Alt-Schlüssel auf die neue Palette gelegt, damit nichts bricht
    orange: primary,
    blue: statusTransit,
    green: statusDone,
    lightGray,
    darkGray,
    white,
    charcoal,
    darkModeRed,
  },
};

// Hero-Verläufe der Landingpage/Business-Seiten — nur Schwarz → Rot
export const Gradients = {
  header: [charcoal, '#2b2b2b'] as const,
  hero: [charcoal, '#3a1414', primary] as const,
  content: [charcoal, '#3a1414'] as const,
};

/** 8px-Raster (mit 4px als Halbschritt für feine Abstände). */
export const Spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const Layout = {
  /** Mindestgröße für Tap-Ziele laut HIG */
  minTouch: 44,
  /** Lesbare Inhaltsbreite auf dem Tablet */
  contentMaxWidth: 760,
  /** Formulare und Detailseiten auf Laptop/Desktop (zweispaltig) */
  formMaxWidth: 1040,
  /** Dashboards und Listen mit Kartenraster auf Laptop/Desktop */
  wideMaxWidth: 1280,
  tabletBreakpoint: 768,
  desktopBreakpoint: 1024,
  /** Ab hier drei Kartenspalten */
  wideBreakpoint: 1500,
} as const;

/**
 * iOS-Typografie-Skala. Große Überschriften mit engem Zeilenabstand und
 * leicht negativer Laufweite, Fließtext mit großzügigem Zeilenabstand.
 */
export const Typography = {
  largeTitle: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: 0.2 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: 0.2 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: 0 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: 0 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.4 },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400', letterSpacing: -0.4 },
  callout: { fontSize: 16, lineHeight: 22, fontWeight: '400', letterSpacing: -0.3 },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.2 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: -0.1 },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0 },
  caption2: { fontSize: 11, lineHeight: 14, fontWeight: '400', letterSpacing: 0.1 },
} satisfies Record<string, TextStyle>;

/**
 * Dezente Schatten statt harter Rahmen. Im Dark Mode tragen Schatten kaum,
 * dort übernimmt die hellere Oberflächenfarbe die Abgrenzung.
 */
export function shadow(level: 1 | 2 | 3 = 1, scheme: 'light' | 'dark' = 'light'): ViewStyle {
  const factor = scheme === 'dark' ? 0 : 1;
  const presets = {
    1: { y: 1, radius: 3, opacity: 0.06, elevation: 1 },
    2: { y: 4, radius: 12, opacity: 0.08, elevation: 3 },
    3: { y: 10, radius: 24, opacity: 0.12, elevation: 8 },
  }[level];
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: presets.y },
    shadowOpacity: presets.opacity * factor,
    shadowRadius: presets.radius,
    elevation: scheme === 'dark' ? 0 : presets.elevation,
  };
}

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', ui-rounded, -apple-system, system-ui, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
