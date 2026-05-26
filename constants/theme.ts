/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// TransLog Pro colors
const primary = '#9b2321'; // RAL 3002 - Primary
const secondary = '#5e5e5e'; // Dark gray - Secondary
const tertiary = '#660000'; // Tertiary
const orange = '#E67E22'; // Orange for OFFEN
const blue = '#3498DB'; // Blue for UNTERWEGS
const green = '#27AE60'; // Green for ABGESCHLOSSEN
const lightGray = '#ECF0F1';
const darkGray = '#5e5e5e';

export const Colors = {
  light: {
    text: '#2C3E50',
    background: '#FFFFFF',
    tint: primary,
    icon: darkGray,
    tabIconDefault: darkGray,
    tabIconSelected: primary,
  },
  dark: {
    text: '#ECF0F1',
    background: '#1A1A1A',
    tint: '#E67E22',
    icon: darkGray,
    tabIconDefault: darkGray,
    tabIconSelected: '#E67E22',
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
  },
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
