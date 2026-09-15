import { FluidPressable } from "@/components/fluid/FluidPressable";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors, Radius, shadow, Spacing, Typography } from "@/constants/theme";
import { type AppTheme, useAppTheme, useThemedStyles } from "@/hooks/use-app-theme";
import { uiStyles } from "@/constants/ui-styles";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "@/hooks/use-translation";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, TextInput } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const styles = useThemedStyles(createStyles);
  const { c, scheme } = useAppTheme();
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { login, isLoading, isAuthenticated, user } = useAuth();
  const { t } = useTranslation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError(t("login", "errorFillFields"));
      return;
    }

    const result = await login(username.trim(), password);

    if (!result.success) {
      // "Invalid login credentials" ist der eine Fall, den ein freundlicher
      // Satz besser beschreibt als die Rohmeldung. Alles andere — etwa
      // "Email not confirmed" oder ein gesperrtes Konto — sagt der Server
      // genauer, als wir es raten könnten. Das pauschal durch
      // "Ungültiger Benutzername oder Passwort" zu ersetzen, schickt bei
      // der Fehlersuche in die falsche Richtung.
      const isWrongCredentials = result.error
        ?.toLowerCase()
        .includes("invalid login credentials");

      setError(
        result.isNetworkError
          ? t("login", "errorUnreachable")
          : isWrongCredentials || !result.error
            ? t("login", "errorInvalid")
            : result.error,
      );
    } else {
      setError("");
    }
  };

  const themeColors = Colors[colorScheme ?? "light"];

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (user?.role === "boss") {
        router.replace("/chef");
      } else {
        router.replace("/driver");
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.contentContainer}>
        <ThemedText type="title" style={styles.title}>
          {t("login", "title")}
        </ThemedText>

        <ThemedText style={styles.subtitle}>
          {t("login", "subtitle")}
        </ThemedText>

        {error ? (
          <ThemedView style={[styles.errorBox, { backgroundColor: themeColors.dangerSoft }]}>
            <ThemedText style={{ color: themeColors.danger }}>{error}</ThemedText>
          </ThemedView>
        ) : null}

        <TextInput
          placeholderTextColor={c.placeholder}
          keyboardAppearance={scheme}
          style={[
            styles.input,
            {
              borderColor: themeColors.separator,
              color: themeColors.text,
              backgroundColor: themeColors.surface,
            },
          ]}
          placeholder={t("login", "usernamePlaceholder")}
          value={username}
          onChangeText={setUsername}
          editable={!isLoading}
          autoCapitalize="none"
          autoComplete="username"
        />

        <TextInput
          placeholderTextColor={c.placeholder}
          keyboardAppearance={scheme}
          style={[
            styles.input,
            {
              borderColor: themeColors.separator,
              color: themeColors.text,
              backgroundColor: themeColors.surface,
            },
          ]}
          placeholder={t("login", "passwordPlaceholder")}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!isLoading}
          autoCapitalize="none"
          autoComplete="password"
        />

        <FluidPressable
          style={[
            styles.loginButton,
            {
              backgroundColor: themeColors.tintFill,
              opacity: isLoading ? 0.6 : 1,
            },
          ]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <ThemedText style={styles.loginButtonText}>
              {t("login", "loginButton")}
            </ThemedText>
          )}
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
    input: {
      ...u.input,
      marginBottom: Spacing.sm,
    },
    loginButton: {
      ...u.primaryButton,
      marginTop: Spacing.xs,
      marginBottom: Spacing.xs,
    },
    loginButtonText: u.primaryButtonText,
  });
};
