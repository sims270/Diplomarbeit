import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/hooks/use-translation';

// Expo backt EXPO_PUBLIC_* beim Build ins Bundle ein. In Vercel ist der Wert
// nur für Preview und Development gesetzt (siehe PLAN_TESTUMGEBUNG.md), auf
// lsc-itsolutions.net fehlt er. Dort erscheint das Banner deshalb nie.
const IS_TEST_ENVIRONMENT = process.env.EXPO_PUBLIC_APP_ENV === 'test';

/**
 * Gelber Streifen über jeder Seite der Testumgebung, damit niemand die
 * Vorschau mit dem echten Betrieb verwechselt.
 */
export function TestEnvironmentBanner() {
  if (!IS_TEST_ENVIRONMENT) return null;
  return <Banner />;
}

function Banner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[scheme];

  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: palette.testBanner, paddingTop: insets.top + 4 }]}
    >
      <Text style={[styles.title, { color: palette.onTestBanner }]}>
        {t('common', 'testEnvironment')}
      </Text>
      <Text style={[styles.hint, { color: palette.onTestBanner }]} numberOfLines={2}>
        {t('common', 'testEnvironmentHint')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'center',
    columnGap: 8,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
  },
});
