import { Tabs } from "expo-router";
import React from "react";
import { StyleSheet } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { RevenueFuelIcon } from "@/components/ui/revenue-fuel-icon";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

// Eigene Gruppe statt Tabs direkt in app/chef/_layout.tsx: Fahrer, LKW und
// Aufträge öffnen sich im Stack darüber und sollen die Tab-Leiste nicht
// unter jeder Detailseite mitschleppen.
export default function ChefTabLayout() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? "light"];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.tint,
        tabBarInactiveTintColor: palette.tabIconDefault,
        // Gleiche Optik wie die Tab-Leiste des Fahrers (app/driver/_layout.tsx)
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
        name="tank"
        options={{
          title: "Umsatz-Tankliste",
          tabBarIcon: ({ color }) => <RevenueFuelIcon size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
