import { FluidPressable } from "@/components/fluid/FluidPressable";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors, Layout, Radius, shadow, Spacing, Typography } from "@/constants/theme";
import { type AppTheme, useThemedStyles } from "@/hooks/use-app-theme";
import { uiStyles } from "@/constants/ui-styles";
import { Language, ThemePreference, useSettings } from "@/contexts/settings-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "@/hooks/use-translation";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Switch } from "react-native";

export default function SettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { t } = useTranslation();
  const {
    themePreference,
    setThemePreference,
    notificationsEnabled,
    setNotificationsEnabled,
    language,
    setLanguage,
  } = useSettings();

  const themeColors = Colors[colorScheme ?? "light"];

  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: "light", label: t("settings", "themeLight") },
    { value: "dark", label: t("settings", "themeDark") },
    { value: "system", label: t("settings", "themeSystem") },
  ];

  const languageOptions: { value: Language; label: string }[] = [
    { value: "de", label: t("settings", "languageGerman") },
    { value: "en", label: t("settings", "languageEnglish") },
  ];

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.contentContainer}>
        <ThemedText type="title" style={styles.title}>
          {t("settings", "title")}
        </ThemedText>

        <ThemedText style={styles.subtitle}>
          {t("settings", "subtitle")}
        </ThemedText>

        <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
          {t("settings", "sectionDesign")}
        </ThemedText>

        <ThemedView style={styles.optionsRow}>
          {themeOptions.map((option) => {
            const isActive = themePreference === option.value;
            return (
              <FluidPressable
                key={option.value}
                style={[
                  styles.optionButton,
                  {
                    borderColor: themeColors.tint,
                    backgroundColor: isActive
                      ? themeColors.tintFill
                      : "transparent",
                  },
                ]}
                onPress={() => setThemePreference(option.value)}
              >
                <ThemedText
                  style={{
                    color: isActive ? "white" : themeColors.text,
                  }}
                >
                  {option.label}
                </ThemedText>
              </FluidPressable>
            );
          })}
        </ThemedView>

        <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
          {t("settings", "sectionLanguage")}
        </ThemedText>

        <ThemedView style={styles.optionsRow}>
          {languageOptions.map((option) => {
            const isActive = language === option.value;
            return (
              <FluidPressable
                key={option.value}
                style={[
                  styles.optionButton,
                  {
                    borderColor: themeColors.tint,
                    backgroundColor: isActive
                      ? themeColors.tintFill
                      : "transparent",
                  },
                ]}
                onPress={() => setLanguage(option.value)}
              >
                <ThemedText
                  style={{
                    color: isActive ? "white" : themeColors.text,
                  }}
                >
                  {option.label}
                </ThemedText>
              </FluidPressable>
            );
          })}
        </ThemedView>

        <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
          {t("settings", "sectionNotifications")}
        </ThemedText>

        <ThemedView style={styles.switchRow}>
          <ThemedText style={styles.switchLabel}>
            {t("settings", "notificationsLabel")}
          </ThemedText>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ true: themeColors.tintFill, false: themeColors.surfaceTertiary }}
            thumbColor="#FFFFFF"
            // react-native-web färbt den Knopf sonst türkis (#009688)
            {...({ activeThumbColor: "#FFFFFF" } as object)}
          />
        </ThemedView>

        <FluidPressable
          style={[styles.backButton, { borderColor: themeColors.tint }]}
          onPress={() => router.back()}
        >
          <ThemedText style={{ color: themeColors.tint }}>
            {t("settings", "back")}
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
      marginBottom: Spacing.md,
      textAlign: 'center',
    },
    sectionTitle: {
      ...u.sectionTitle,
      marginTop: Spacing.md,
    },
    // Auswahl als iOS-Segmented-Control, aktive Option rot
    optionsRow: {
      flexDirection: 'row',
      padding: 2,
      gap: 2,
      borderRadius: Radius.sm + 2,
      backgroundColor: c.surfaceTertiary,
      marginBottom: Spacing.xs,
    },
    optionButton: {
      flex: 1,
      minHeight: Layout.minTouch - 4,
      borderWidth: 0,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.xxs,
      alignItems: 'center',
      justifyContent: 'center',
    },
    switchRow: {
      minHeight: 52,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.md,
      backgroundColor: c.surfaceSecondary,
      marginBottom: Spacing.lg,
    },
    switchLabel: {
      ...Typography.body,
      flexShrink: 1,
    },
    backButton: {
      ...u.tintedButton,
      borderWidth: 0,
    },
  });
};
