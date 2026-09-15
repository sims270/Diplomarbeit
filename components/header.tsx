import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/app/context/AuthContext';
import { useTranslation } from '@/hooks/use-translation';
import { type AppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { FluidPressable } from '@/components/fluid/FluidPressable';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  code?: string;
}

export function Header({ title, subtitle, code }: HeaderProps) {
  const router = useRouter();
  const { isAuthenticated, user, isOfflineMode } = useAuth();
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

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
      <View style={styles.rightContainer}>
        {code && (
          <FluidPressable style={styles.codeButton} onPress={handleCodePress}>
            <Text style={styles.code}>{code}</Text>
          </FluidPressable>
        )}
        {/* Fahrer- und LKW-Verwaltung. Beide nur für den Chef und nur
            online: Ohne gültiges JWT erkennt weder die Edge Function noch
            die RLS-Policy ihn als Chef, die Ansichten kämen leer zurück. */}
        {user?.role === 'boss' && !isOfflineMode && (
          <>
            <FluidPressable
              style={styles.settingsButton}
              onPress={() => router.push('/chef/drivers')}
              accessibilityLabel={t('chefProfile', 'createDriverCardButton')}
            >
              <Text style={styles.settingsButtonText}>👤</Text>
            </FluidPressable>
            <FluidPressable
              style={styles.settingsButton}
              onPress={() => router.push('/chef/vehicles')}
              accessibilityLabel={t('chefProfile', 'vehiclesCardButton')}
            >
              <Text style={styles.settingsButtonText}>🚚</Text>
            </FluidPressable>
          </>
        )}
        <FluidPressable
          style={styles.settingsButton}
          onPress={() => router.push('/settings')}
        >
          <Text style={styles.settingsButtonText}>⚙</Text>
        </FluidPressable>
        {isAuthenticated && (
          <FluidPressable
            style={styles.logoutButton}
            onPress={() => router.push('/logout')}
          >
            <Text style={styles.logoutButtonText}>{t('common', 'logout')}</Text>
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
    rightContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    codeButton: {
      minWidth: Layout.minTouch,
      height: Layout.minTouch,
      paddingHorizontal: Spacing.sm,
      borderRadius: Radius.pill,
      backgroundColor: c.tintFill,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    code: {
      ...Typography.headline,
      color: c.onTint,
    },
    settingsButton: {
      width: Layout.minTouch,
      height: Layout.minTouch,
      borderRadius: Radius.pill,
      backgroundColor: c.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingsButtonText: {
      fontSize: 18,
      lineHeight: 22,
      color: c.text,
    },
    logoutButton: {
      minHeight: Layout.minTouch,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.pill,
      backgroundColor: c.tintSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoutButtonText: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.tint,
    },
  });
