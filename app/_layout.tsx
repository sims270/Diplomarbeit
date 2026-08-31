import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

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

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
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
