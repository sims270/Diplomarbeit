import { webInputStyle } from '@/components/DateField.web';
import { useAppTheme } from '@/hooks/use-app-theme';

interface TimeFieldProps {
  value: string;
  onChange: (time: string) => void;
  placeholder?: string;
}

// Web gets a plain native <input type="time"> — every browser ships its own
// time picker for it, and @react-native-community/datetimepicker has no web
// implementation at all (it just warns and renders null there).
export function TimeField({ value, onChange }: TimeFieldProps) {
  const { c, scheme } = useAppTheme();
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={webInputStyle(c, scheme)}
    />
  );
}
