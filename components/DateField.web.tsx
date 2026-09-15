import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import type { CSSProperties } from 'react';

interface DateFieldProps {
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
}

// Web gets a plain native <input type="date"> — every browser ships its own
// calendar picker for it, and @react-native-community/datetimepicker has no
// web implementation at all (it just warns and renders null there).
export function DateField({ value, onChange }: DateFieldProps) {
  const { c, scheme } = useAppTheme();
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={webInputStyle(c, scheme)}
    />
  );
}

/** Web-Eingabefeld im selben Look wie die nativen Felder (48px, 17px Schrift). */
export function webInputStyle(
  c: ReturnType<typeof useAppTheme>['c'],
  scheme: 'light' | 'dark',
): CSSProperties {
  return {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    minHeight: 48,
    border: `1px solid ${c.separator}`,
    borderRadius: Radius.md,
    padding: `${Spacing.sm}px ${Spacing.md}px`,
    marginBottom: Spacing.xs,
    fontSize: 17,
    lineHeight: '24px',
    fontFamily: 'inherit',
    color: c.text,
    backgroundColor: c.surface,
    accentColor: c.tint,
    colorScheme: scheme,
    outlineColor: c.tint,
  };
}
