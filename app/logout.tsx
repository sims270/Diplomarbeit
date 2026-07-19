import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "@/hooks/use-translation";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

export default function LogoutScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { logout, isLoading } = useAuth();
  const { t } = useTranslation();

  const [error, setError] = useState("");

  const handleLogout = async () => {
    try {
      await logout();
      setError("");
      router.replace("/");
    } catch {
      setError(t("logout", "errorGeneric"));
    }
  };

  const themeColors = Colors[colorScheme ?? "light"];

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.contentContainer}>
        <ThemedText type="title" style={styles.title}>
          {t("logout", "title")}
        </ThemedText>

        <ThemedText style={styles.subtitle}>
          {t("logout", "subtitle")}
        </ThemedText>

        {error ? (
          <ThemedView style={[styles.errorBox, { backgroundColor: "#ffebee" }]}>
            <ThemedText style={{ color: "#c62828" }}>{error}</ThemedText>
          </ThemedView>
        ) : null}

        <Pressable
          style={[
            styles.logoutButton,
            {
              backgroundColor: themeColors.tint,
              opacity: isLoading ? 0.6 : 1,
            },
          ]}
          onPress={handleLogout}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <ThemedText style={styles.logoutButtonText}>{t("logout", "logoutButton")}</ThemedText>
          )}
        </Pressable>

        <Pressable
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={isLoading}
        >
          <ThemedText style={{ color: themeColors.tint }}>
            {t("logout", "cancelButton")}
          </ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  contentContainer: {
    width: "100%",
    maxWidth: 400,
  },
  title: {
    fontSize: 28,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: "center",
    opacity: 0.7,
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  logoutButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  cancelButton: {
    paddingVertical: 10,
    alignItems: "center",
  },
});
