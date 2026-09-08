import { Colors } from '@/constants/theme';
import type { CSSProperties } from 'react';

interface TimeFieldProps {
  value: string;
  onChange: (time: string) => void;
  placeholder?: string;
}

// Web gets a plain native <input type="time"> — every browser ships its own
// time picker for it, and @react-native-community/datetimepicker has no web
// implementation at all (it just warns and renders null there).
export function TimeField({ value, onChange }: TimeFieldProps) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={styles.input}
    />
  );
}

const styles: Record<string, CSSProperties> = {
  input: {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    border: `1px solid ${Colors.light.border}`,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontSize: 14,
    fontFamily: 'inherit',
    color: Colors.ui.charcoal,
    backgroundColor: 'white',
  },
};
