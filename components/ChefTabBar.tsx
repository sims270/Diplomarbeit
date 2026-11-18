import { IconSymbol } from '@/components/ui/icon-symbol';
import { RevenueFuelIcon } from '@/components/ui/revenue-fuel-icon';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/hooks/use-translation';
import * as Haptics from 'expo-haptics';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ChefTab = '/chef' | '/chef/tank' | '/chef/profile';

const TAB_ROUTES: string[] = ['/chef', '/chef/tank', '/chef/profile'];

// Unterseiten zählen zu dem Eintrag, von dem aus der Chef sie öffnet.
function activeTabFor(pathname: string): ChefTab {
  if (pathname.startsWith('/chef/tank')) return '/chef/tank';
  if (
    pathname.startsWith('/chef/profile') ||
    pathname.startsWith('/chef/account') ||
    pathname.startsWith('/chef/bosses')
  ) {
    return '/chef/profile';
  }
  return '/chef';
}

/**
 * Die Leiste unten im Chef-Bereich. Sie sitzt in app/chef/_layout.tsx unter dem
 * Stack, weil die Tab-Leiste von app/chef/(tabs)/ von jeder Unterseite im Stack
 * verdeckt würde.
 */
export function ChefTabBar() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // Auf dem Handy nähme die Leiste sonst über der Tastatur Platz vom Formular.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (isKeyboardOpen) return null;

  const activeTab = activeTabFor(pathname);

  const openTab = (href: ChefTab) => {
    if (pathname === href) return;
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Von einer Unterseite aus den Stack abbauen, sonst stapeln sich die Seiten
    // bei jedem Wechsel und "Zurück" führte durch alle früheren.
    if (TAB_ROUTES.includes(pathname)) {
      router.navigate(href);
    } else {
      router.dismissTo(href);
    }
  };

  const tabs: { href: ChefTab; label: string; icon: (color: string) => React.ReactNode }[] = [
    {
      href: '/chef',
      label: t('chefTabs', 'dashboard'),
      icon: (color) => <IconSymbol size={28} name="square.grid.2x2" color={color} />,
    },
    {
      href: '/chef/tank',
      label: t('chefTabs', 'lists'),
      icon: (color) => <RevenueFuelIcon size={28} color={color} />,
    },
    {
      href: '/chef/profile',
      label: t('chefTabs', 'profile'),
      icon: (color) => <IconSymbol size={28} name="person.fill" color={color} />,
    },
  ];

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: palette.barSolid,
          borderTopColor: palette.separator,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {tabs.map(({ href, label, icon }) => {
        const isActive = activeTab === href;
        const color = isActive ? palette.tint : palette.tabIconDefault;
        return (
          <Pressable
            key={href}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => openTab(href)}
            style={styles.tab}
          >
            {icon(color)}
            <Text style={[styles.label, { color }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    minHeight: 49,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
