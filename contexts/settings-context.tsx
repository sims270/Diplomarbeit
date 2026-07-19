import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'light' | 'dark' | 'system';
export type Language = 'de' | 'en';

interface SettingsContextType {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  language: Language;
  setLanguage: (language: Language) => void;
  isLoading: boolean;
}

const THEME_PREFERENCE_KEY = 'settings.themePreference';
const NOTIFICATIONS_ENABLED_KEY = 'settings.notificationsEnabled';
const LANGUAGE_KEY = 'settings.language';

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [language, setLanguageState] = useState<Language>('de');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedTheme = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
        if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
          setThemePreferenceState(storedTheme);
        }

        const storedNotifications = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
        if (storedNotifications !== null) {
          setNotificationsEnabledState(storedNotifications === 'true');
        }

        const storedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
        if (storedLanguage === 'de' || storedLanguage === 'en') {
          setLanguageState(storedLanguage);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const setThemePreference = (preference: ThemePreference) => {
    setThemePreferenceState(preference);
    AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference).catch((error) =>
      console.error('Error saving theme preference:', error)
    );
  };

  const setNotificationsEnabled = (enabled: boolean) => {
    setNotificationsEnabledState(enabled);
    AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(enabled)).catch((error) =>
      console.error('Error saving notification preference:', error)
    );
  };

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
    AsyncStorage.setItem(LANGUAGE_KEY, newLanguage).catch((error) =>
      console.error('Error saving language preference:', error)
    );
  };

  return (
    <SettingsContext.Provider
      value={{
        themePreference,
        setThemePreference,
        notificationsEnabled,
        setNotificationsEnabled,
        language,
        setLanguage,
        isLoading,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
