import { useColorScheme as useRNColorScheme } from 'react-native';
import { useSettings } from '@/contexts/settings-context';

export function useColorScheme() {
  const systemScheme = useRNColorScheme();
  const { themePreference } = useSettings();

  if (themePreference === 'system') {
    return systemScheme;
  }

  return themePreference;
}
