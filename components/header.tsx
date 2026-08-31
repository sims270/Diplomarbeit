import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/app/context/AuthContext';
import { useTranslation } from '@/hooks/use-translation';
import { FluidPressable } from '@/components/fluid/FluidPressable';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  code?: string;
}

export function Header({ title, subtitle, code }: HeaderProps) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { t } = useTranslation();

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
    <View style={styles.header}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.rightContainer}>
        {code && (
          <FluidPressable style={styles.codeButton} onPress={handleCodePress}>
            <Text style={styles.code}>{code}</Text>
          </FluidPressable>
        )}
        {user?.role === 'boss' && (
          <FluidPressable
            style={styles.settingsButton}
            onPress={() => router.push('/chef/drivers')}
            accessibilityLabel={t('chefProfile', 'createDriverCardButton')}
          >
            <Text style={styles.settingsButtonText}>👤</Text>
          </FluidPressable>
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

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.ui.primary,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeButton: {
    borderRadius: 6,
    overflow: 'hidden',
  },
  code: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  settingsButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
  settingsButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
  },
  logoutButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  logoutButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'white',
  },
});
