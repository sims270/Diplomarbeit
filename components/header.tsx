import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { useTranslation } from "@/hooks/use-translation";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export interface HeaderProps {
  title: string;
  subtitle?: string;
  code?: string;
  // optional override to handle when the code badge is pressed
  onCodePress?: () => void;
  // showLogout forces the logout button to be visible even if auth hasn't initialized
  showLogout?: boolean;
}

export function Header({
  title,
  subtitle,
  code,
  onCodePress,
  showLogout,
}: HeaderProps) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { t } = useTranslation();

  const handleCodePress = () => {
    if (onCodePress) return onCodePress();

    try {
      if (user?.role === "driver") {
        router.push("/driver/profile");
        return;
      }
      if (user?.role === "boss" || user?.role === "chef") {
        router.push("/chef/profile");
        return;
      }

      // Fallback: try to infer route from current location (web) so reloads still work
      try {
        if (
          typeof window !== "undefined" &&
          window.location &&
          window.location.pathname
        ) {
          const p = window.location.pathname.toLowerCase();
          if (p.startsWith("/driver")) {
            router.push("/driver/profile");
            return;
          }
          if (p.startsWith("/chef") || p.startsWith("/business")) {
            router.push("/chef/profile");
            return;
          }
        }
      } catch {
        // ignore
      }

      // final fallback
      router.push("/profile");
    } catch {
      router.push("/logout");
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
          <Pressable style={styles.codeButton} onPress={handleCodePress}>
            <Text style={styles.code}>{code}</Text>
          </Pressable>
        )}
        <Pressable
          style={styles.settingsButton}
          onPress={() => router.push("/settings")}
        >
          <Text style={styles.settingsButtonText}>⚙</Text>
        </Pressable>
        {(showLogout || user || isAuthenticated) && (
          <Pressable
            style={styles.logoutButton}
            onPress={() => router.push("/logout")}
          >
            <Text style={styles.logoutButtonText}>{t("common", "logout")}</Text>
          </Pressable>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "white",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
    textTransform: "uppercase",
  },
  rightContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  code: {
    fontSize: 14,
    fontWeight: "700",
    color: "white",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  codeButton: {
    borderRadius: 6,
    overflow: "hidden",
  },
  settingsButton: {
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
  settingsButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "white",
  },
  logoutButton: {
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  logoutButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "white",
  },
});
