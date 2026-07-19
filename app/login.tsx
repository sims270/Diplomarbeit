import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "@/hooks/use-translation";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
} from "react-native";

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const { login, isLoading } = useAuth();
  const { t } = useTranslation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError(t("login", "errorFillFields"));
      return;
    }

    const result = await login(username, password, rememberMe);

    if (!result.success) {
      setError(t("login", "errorInvalid"));
      setPassword("");
    } else {
      setError("");
      setUsername("");
      setPassword("");
    }
  };

  const themeColors = Colors[colorScheme ?? "light"];

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.contentContainer}>
        <ThemedText type="title" style={styles.title}>
          {t("login", "title")}
        </ThemedText>

        <ThemedText style={styles.subtitle}>{t("login", "subtitle")}</ThemedText>

        {error ? (
          <ThemedView style={[styles.errorBox, { backgroundColor: "#ffebee" }]}>
            <ThemedText style={{ color: "#c62828" }}>{error}</ThemedText>
          </ThemedView>
        ) : null}

        <TextInput
          style={[
            styles.input,
            {
              borderColor: themeColors.border || "#ccc",
              color: themeColors.text,
              backgroundColor: themeColors.background,
            },
          ]}
          placeholder={t("login", "usernamePlaceholder")}
          placeholderTextColor={themeColors.tabIconDefault}
          value={username}
          onChangeText={setUsername}
          editable={!isLoading}
          autoCapitalize="none"
        />

        <TextInput
          style={[
            styles.input,
            {
              borderColor: themeColors.border || "#ccc",
              color: themeColors.text,
              backgroundColor: themeColors.background,
            },
          ]}
          placeholder={t("login", "passwordPlaceholder")}
          placeholderTextColor={themeColors.tabIconDefault}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!isLoading}
          autoCapitalize="none"
        />

        <Pressable
          style={styles.checkboxContainer}
          onPress={() => setRememberMe(!rememberMe)}
          disabled={isLoading}
        >
          <ThemedView
            style={[
              styles.checkbox,
              {
                backgroundColor: rememberMe ? themeColors.tint : "transparent",
                borderColor: themeColors.tint,
              },
            ]}
          >
            {rememberMe && (
              <ThemedText style={{ color: "white" }}>✓</ThemedText>
            )}
          </ThemedView>
          <ThemedText style={styles.checkboxLabel}>{t("login", "rememberMe")}</ThemedText>
        </Pressable>

        <Pressable
          style={[
            styles.loginButton,
            {
              backgroundColor: themeColors.tint,
              opacity: isLoading ? 0.6 : 1,
            },
          ]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <ThemedText style={styles.loginButtonText}>Login</ThemedText>
          )}
        </Pressable>

        {/*
        <ThemedView style={styles.demoBox}>
          <ThemedText type="defaultSemiBold" style={styles.demoTitle}>
            Demo Credentials
          </ThemedText>
          <ThemedText style={styles.demoText}>
            Boss:{'\n'}
            Username: boss{'\n'}
            Password: boss123
          </ThemedText>
          <ThemedText style={styles.demoText}>
            Driver:{'\n'}
            Username: driver{'\n'}
            Password: driver123
          </ThemedText>
        </ThemedView>
        */}
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
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  checkboxLabel: {
    fontSize: 14,
  },
  loginButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 24,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  demoBox: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  demoTitle: {
    marginBottom: 8,
    fontSize: 14,
  },
  demoText: {
    fontSize: 12,
    marginBottom: 8,
    fontFamily: "monospace",
  },
});
