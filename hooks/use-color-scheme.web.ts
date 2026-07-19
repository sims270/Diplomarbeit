import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useSettings } from '@/contexts/settings-context';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const systemScheme = useRNColorScheme();
  const { themePreference } = useSettings();

  if (!hasHydrated) {
    return 'light';
  }

  if (themePreference === 'system') {
    return systemScheme;
  }

  return themePreference;
}
