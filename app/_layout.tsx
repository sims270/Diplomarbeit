import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider } from "@/contexts/auth-context";
import { SettingsProvider } from "@/contexts/settings-context";

function RootContent() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ animationEnabled: false, headerShown: false }}>
        <Stack.Screen
          name="/business"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="/chef"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="/login"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen name="/driver" options={{ headerShown: false }} />
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
