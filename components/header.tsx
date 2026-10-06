import React, { type ComponentProps, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/app/context/AuthContext';
import { useTranslation } from '@/hooks/use-translation';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { refreshReminders, useReminders } from '@/hooks/use-reminders';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  code?: string;
}

type IconName = ComponentProps<typeof MaterialIcons>['name'];

export function Header({ title, subtitle, code }: HeaderProps) {
  const router = useRouter();
  const { isAuthenticated, user, isOfflineMode } = useAuth();
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const { c, isTablet } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { reminders, loaded: remindersLoaded } = useReminders();

  // Der Header sitzt auf jedem Chef-Screen. Geladen wird nur, wenn noch
  // nichts da ist — danach hält das Dashboard (bei jedem Öffnen) und die
  // Erinnerungsseite die Zahl aktuell.
  // Die Chef-Werkzeuge nur online: Ohne gültiges JWT erkennt weder die Edge
  // Function noch die RLS-Policy ihn als Chef, die Ansichten kämen leer zurück.
  const isBossOnline = user?.role === 'boss' && !isOfflineMode;
  useEffect(() => {
    if (isBossOnline && !remindersLoaded) {
      refreshReminders();
    }
  }, [isBossOnline, remindersLoaded]);

  const handleCodePress = () => {
    try {
      if (user?.role === 'driver') {
        router.push('/driver/profile');
        return;
      }
      if (user?.role === 'boss') {
        router.push('/chef/profile');
        return;
      }

      // Fallback: try to infer route from current location (web) so reloads still work
      try {
        if (
          typeof window !== 'undefined' &&
          window.location &&
          window.location.pathname
        ) {
          const p = window.location.pathname.toLowerCase();
          if (p.startsWith('/driver')) {
            router.push('/driver/profile');
            return;
          }
          if (p.startsWith('/chef') || p.startsWith('/business')) {
            router.push('/chef/profile');
            return;
          }
        }
      } catch {
        // ignore
      }
    } catch {
      router.push('/logout');
    }
  };

  // Werkzeugleiste: Erinnerungen, Fahrer, LKW, Auflieger (nur Chef) und
  // Einstellungen (alle). Echte Icons statt Emojis — die sehen auf jedem
  // Gerät anders aus und wirken verspielt.
  const toolbarItems: {
    icon: IconName;
    label: string;
    onPress: () => void;
    badge?: number;
  }[] = [
    ...(isBossOnline
      ? [
          {
            icon: (reminders.length > 0 ? 'notifications-active' : 'notifications-none') as IconName,
            label: t('reminders', 'title'),
            onPress: () => router.push('/chef/reminders'),
            badge: reminders.length,
          },
          {
            icon: 'group' as IconName,
            label: t('chefProfile', 'createDriverCardButton'),
            onPress: () => router.push('/chef/drivers'),
          },
          {
            icon: 'local-shipping' as IconName,
            label: t('chefProfile', 'vehiclesCardButton'),
            onPress: () => router.push('/chef/vehicles'),
          },
          {
            icon: 'rv-hookup' as IconName,
            label: t('chefProfile', 'trailersCardButton'),
            onPress: () => router.push('/chef/trailers'),
          },
        ]
      : []),
    {
      icon: 'settings',
      label: t('settings', 'title'),
      onPress: () => router.push('/settings'),
    },
  ];

  return (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        {isOfflineMode && (
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineBadgeText}>
              {t('common', 'offlineMode')}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <View style={styles.toolbar}>
          {toolbarItems.map((item) => (
            <FluidPressable
              key={item.icon}
              style={styles.iconButton}
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={
                item.badge ? `${item.label}: ${item.badge}` : item.label
              }
            >
              <MaterialIcons name={item.icon} size={22} color={c.icon} />
              {!!item.badge && (
                <View style={styles.countBadge} pointerEvents="none">
                  <Text style={styles.countBadgeText}>
                    {item.badge > 99 ? '99+' : item.badge}
                  </Text>
                </View>
              )}
            </FluidPressable>
          ))}
        </View>

        {(code || isAuthenticated) && <View style={styles.divider} />}

        {/* Konto: Kürzel als Avatar führt zum Profil, daneben Abmelden. */}
        {code && (
          <FluidPressable
            style={styles.avatar}
            onPress={handleCodePress}
            accessibilityRole="button"
          >
            <Text style={styles.avatarText}>{code}</Text>
          </FluidPressable>
        )}
        {isAuthenticated && (
          <FluidPressable
            style={styles.logoutButton}
            onPress={() => router.push('/logout')}
            accessibilityRole="button"
            accessibilityLabel={t('common', 'logout')}
          >
            <MaterialIcons name="logout" size={18} color={c.textSecondary} />
            {/* Am Handy nur das Icon — dort zählt jeder Zentimeter. */}
            {isTablet && <Text style={styles.logoutButtonText}>{t('common', 'logout')}</Text>}
          </FluidPressable>
        )}
      </View>
    </View>
  );
}

const createStyles = ({ c, isTablet, isDesktop, sideInset }: AppTheme) =>
  StyleSheet.create({
    // iOS-Navigationsleiste: Materialfläche, großer Titel, Haarlinie unten.
    // Auf schmalen Geräten rutschen die Aktionen unter den Titel.
    header: {
      backgroundColor: c.barSolid,
      // Gleicher Seitenabstand wie die Listen, damit Header und Inhalt fluchten
      paddingHorizontal: sideInset(isDesktop ? Layout.wideMaxWidth : Layout.contentMaxWidth),
      paddingBottom: Spacing.md,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      rowGap: Spacing.sm,
      columnGap: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    titleContainer: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 200,
    },
    title: {
      ...(isTablet ? Typography.largeTitle : Typography.title1),
      color: c.text,
    },
    subtitle: {
      ...Typography.footnote,
      fontWeight: '600',
      color: c.textSecondary,
      marginTop: Spacing.xxs,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    offlineBadge: {
      alignSelf: 'flex-start',
      marginTop: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xxs,
      borderRadius: Radius.pill,
      backgroundColor: c.tintSoft,
    },
    offlineBadgeText: {
      ...Typography.caption1,
      fontWeight: '700',
      color: c.tint,
      letterSpacing: 0.4,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    // Die Werkzeuge als eine zusammenhängende Leiste statt einzelner Kreise.
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 2,
      gap: 2,
      borderRadius: Radius.md,
      backgroundColor: c.surfaceSecondary,
    },
    iconButton: {
      width: Layout.minTouch - 4,
      height: Layout.minTouch - 4,
      borderRadius: Radius.sm + 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Rote Zahl rechts oben an der Glocke, wie bei einer App-Benachrichtigung.
    countBadge: {
      position: 'absolute',
      top: 1,
      right: 1,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: Radius.pill,
      backgroundColor: c.tintFill,
      borderWidth: 2,
      borderColor: c.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countBadgeText: {
      fontSize: 10,
      lineHeight: 12,
      fontWeight: '700',
      color: c.onTint,
    },
    divider: {
      width: StyleSheet.hairlineWidth,
      height: 28,
      backgroundColor: c.separator,
    },
    avatar: {
      width: Layout.minTouch - 4,
      height: Layout.minTouch - 4,
      borderRadius: Radius.pill,
      backgroundColor: c.tintSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      ...Typography.subhead,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: c.tint,
    },
    logoutButton: {
      minWidth: Layout.minTouch - 4,
      height: Layout.minTouch - 4,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xxs,
      paddingHorizontal: isTablet ? Spacing.sm : 0,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.separator,
    },
    logoutButtonText: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.textSecondary,
    },
  });
