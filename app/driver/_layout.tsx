import { Redirect, Tabs } from "expo-router";
import React from "react";
import { StyleSheet } from "react-native";

import { homeRouteFor, useAuth } from "@/app/context/AuthContext";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? "light"];
  const { user, isLoading } = useAuth();

  // Nur eigene Fahrer — ein fremder Fahrer hätte hier Tankliste und
  // Profil vor sich, die für ihn nicht gedacht sind. Nicht Angemeldete
  // gehören auf den Login.
  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== "driver") {
    return <Redirect href={homeRouteFor(user.role)} />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.tint,
        tabBarInactiveTintColor: palette.tabIconDefault,
        // iOS-Tab-Bar: Materialfarbe mit Haarlinie statt Schatten
        tabBarStyle: {
          backgroundColor: palette.barSolid,
          borderTopColor: palette.separator,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.1,
        },
        tabBarItemStyle: { minHeight: 44 },
        sceneStyle: { backgroundColor: palette.background },
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="square.grid.2x2" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tankliste"
        options={{
          title: "Tankliste",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="fuelpump.fill" color={color} />
          ),
        }}
      />
      {/* Ohne eigenen Eintrag legt expo-router den Tab mit Standard-Icon an. */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person.fill" color={color} />
          ),
        }}
      />

      {/* Auftragsdetails open from the dashboard, not from the tab bar. */}
      <Tabs.Screen name="order" options={{ href: null }} />

      {/* Der Kartenscreen ist der Tankliste gewichen. expo-router legt für
          jede Datei unter app/driver/ automatisch einen Tab an, deshalb
          reicht es nicht, den Eintrag hier wegzulassen — map.tsx würde
          sonst mit Standardtitel wieder in der Tab-Leiste auftauchen. */}
      <Tabs.Screen name="map" options={{ href: null }} />
    </Tabs>
  );
}
