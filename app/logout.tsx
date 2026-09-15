import { FluidPressable } from "@/components/fluid/FluidPressable";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors, Layout, Radius, shadow, Spacing, Typography } from "@/constants/theme";
import { type AppTheme, useThemedStyles } from "@/hooks/use-app-theme";
import { uiStyles } from "@/constants/ui-styles";
import { useAuth } from "@/app/context/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "@/hooks/use-translation";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";

export default function LogoutScreen() {
  const styles = useThemedStyles(createStyles);
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
          <ThemedView style={[styles.errorBox, { backgroundColor: themeColors.dangerSoft }]}>
            <ThemedText style={{ color: themeColors.danger }}>{error}</ThemedText>
          </ThemedView>
        ) : null}

        <FluidPressable
          style={[
            styles.logoutButton,
            {
              backgroundColor: themeColors.tintFill,
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
        </FluidPressable>

        <FluidPressable
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={isLoading}
        >
          <ThemedText style={{ color: themeColors.tint }}>
            {t("logout", "cancelButton")}
          </ThemedText>
        </FluidPressable>
      </ThemedView>
    </ThemedView>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    container: {
      ...u.screen,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.gutter,
      paddingVertical: Spacing.xl,
    },
    // Zentrale Karte wie ein iOS-Sheet
    contentContainer: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: theme.isTablet ? Spacing.xl : Spacing.lg,
      ...shadow(3, theme.scheme),
    },
    title: {
      ...Typography.title1,
      marginBottom: Spacing.xs,
      textAlign: 'center',
    },
    subtitle: {
      ...Typography.body,
      color: c.textSecondary,
      marginBottom: Spacing.lg,
      textAlign: 'center',
    },
    errorBox: {
      padding: Spacing.sm,
      borderRadius: Radius.md,
      marginBottom: Spacing.md,
    },
    logoutButton: {
      ...u.primaryButton,
      marginBottom: Spacing.xs,
    },
    logoutButtonText: u.primaryButtonText,
    cancelButton: {
      minHeight: Layout.minTouch,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
};
