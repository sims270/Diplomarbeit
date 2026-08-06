import { FluidPressable } from "@/components/fluid/FluidPressable";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, TextInput } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const { login, isLoading } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Please fill in both username and password.");
      return;
    }

    const result = await login(username.trim(), password);

    if (!result.success) {
      setError(result.error ?? "Login failed. Please try again.");
    } else {
      setError("");
    }
  };

  const themeColors = Colors[colorScheme ?? "light"];

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.contentContainer}>
        <ThemedText type="title" style={styles.title}>
          Login
        </ThemedText>

        <ThemedText style={styles.subtitle}>
          Sign in with your username and password
        </ThemedText>

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
          placeholder="Username"
          placeholderTextColor={themeColors.tabIconDefault}
          value={username}
          onChangeText={setUsername}
          editable={!isLoading}
          autoCapitalize="none"
          autoComplete="username"
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
          placeholder="Password"
          placeholderTextColor={themeColors.tabIconDefault}
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
  loginButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
});
