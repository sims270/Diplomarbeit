/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// TransLog Pro colors — corporate palette: red, gray, white
const primary = '#9b2321'; // RAL 3002 - Primary red
const secondary = '#5e5e5e'; // Dark gray - Secondary
const tertiary = '#660000'; // Tertiary (dark red)
const darkModeRed = '#E63946'; // Brighter red for accents on dark backgrounds
const orange = '#E67E22'; // Status color for OFFEN (kept — semantic, not brand)
const blue = '#3498DB'; // Status color for UNTERWEGS
const green = '#27AE60'; // Status color for ABGESCHLOSSEN
const lightGray = '#ECF0F1';
const darkGray = '#5e5e5e';
const charcoal = '#1A1A1A';
const white = '#FFFFFF';

export const Colors = {
  light: {
    text: '#262626',
    background: white,
    border: '#E0E0E0',
    tint: primary,
    icon: darkGray,
    tabIconDefault: darkGray,
    tabIconSelected: primary,
  },
  dark: {
    text: '#F5F5F5',
    background: charcoal,
    border: '#3A3A3A',
    tint: darkModeRed,
    icon: '#B5B5B5',
    tabIconDefault: '#B5B5B5',
    tabIconSelected: darkModeRed,
  },
  status: {
    offen: orange,
    unterwegs: blue,
    erledigt: green,
  },
  ui: {
    primary,
    secondary,
    tertiary,
    orange,
    blue,
    green,
    lightGray,
    darkGray,
    white,
    charcoal,
    darkModeRed,
  },
};

// Reusable red/gray-tinted gradients for hero-style screens (landing page, business pages)
export const Gradients = {
  header: [charcoal, '#2b2b2b'] as const,
  hero: [charcoal, '#3a1414', primary] as const,
  content: [charcoal, '#3a1414'] as const,
};

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
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
