import { FluidPressable } from "@/components/fluid/FluidPressable";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { Language, ThemePreference, useSettings } from "@/contexts/settings-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "@/hooks/use-translation";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Switch } from "react-native";

export default function SettingsScreen() {
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
                      ? themeColors.tint
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
                      ? themeColors.tint
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
            trackColor={{ true: themeColors.tint }}
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
  sectionTitle: {
    fontSize: 16,
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 28,
  },
  optionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
  },
  switchLabel: {
    fontSize: 16,
  },
  backButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
});
