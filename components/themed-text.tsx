import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

// Tracking (letter-spacing) and leading (line-height) are tuned per size,
// not fixed app-wide: large text wants negative tracking and tight
// leading (letters read too spaced-out as they grow), body text wants
// near-zero tracking and generous leading for legibility. Colors are
// untouched here — only spacing/sizing changes.
const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    letterSpacing: 0,
    color: '#0a7ea4',
  },
});
