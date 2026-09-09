import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
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
