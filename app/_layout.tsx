import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider } from "@/app/context/AuthContext";
import { SettingsProvider } from "@/contexts/settings-context";
import { useStackScreenOptions } from "@/lib/motion/useStackScreenOptions";

function RootContent() {
  const colorScheme = useColorScheme();
  // `animationEnabled` (the old stack navigator's prop) isn't valid on
  // native-stack — it was silently ignored, which is why screens never
  // actually animated. `useStackScreenOptions` sets the real option and
  // drops it to 'none' when the OS reduce-motion setting is on, instead
  // of hardcoding animations off for everyone.
  const stackOptions = useStackScreenOptions();

  // Navigations-Theme auf die App-Palette abgestimmt, damit Übergänge
  // zwischen Screens im Dark Mode nicht weiß aufblitzen.
  const scheme = colorScheme === "dark" ? "dark" : "light";
  const baseTheme = scheme === "dark" ? DarkTheme : DefaultTheme;
  const palette = Colors[scheme];
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: palette.tint,
      background: palette.background,
      card: palette.barSolid,
      text: palette.text,
      border: palette.separator,
      notification: palette.tintFill,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.background },
          ...stackOptions,
        }}
      >
        <Stack.Screen
          name="business"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="chef"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="(auth)"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen name="driver" options={{ headerShown: false }} />
        <Stack.Screen name="external" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <RootContent />
      </SettingsProvider>
    </AuthProvider>
  );
}
