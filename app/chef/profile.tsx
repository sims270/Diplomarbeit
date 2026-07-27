import { Header } from "@/components/header";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { useTranslation } from "@/hooks/use-translation";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

export default function ChefProfileScreen() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"profile" | "settings">("profile");
  const [driverName, setDriverName] = useState("");
  const [driverUsername, setDriverUsername] = useState("");
  const [driverPassword, setDriverPassword] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.ui.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const handleCreateDriver = async () => {
    if (
      !driverName.trim() ||
      !driverUsername.trim() ||
      !driverPassword.trim()
    ) {
      Alert.alert(t("common", "error"), t("chefProfile", "alertFillFields"));
      return;
    }

    setIsCreating(true);
    try {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      Alert.alert(
        t("common", "success"),
        `"${driverName}" ${t("chefProfile", "alertDriverCreated")}`,
      );
      setDriverName("");
      setDriverUsername("");
      setDriverPassword("");
    } catch {
      Alert.alert(t("common", "error"), t("chefProfile", "alertCreateFailed"));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="TRANSLOG PRO"
        subtitle={t("chefProfile", "headerSubtitle")}
        code="CH"
        onCodePress={() => router.push("/chef/profile")}
        showLogout={true}
      />

      <View style={styles.tabsContainer}>
        <Pressable
          style={[styles.tab, activeTab === "profile" && styles.tabActive]}
          onPress={() => setActiveTab("profile")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "profile" && styles.tabTextActive,
            ]}
          >
            {t("chefProfile", "tabProfile")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "settings" && styles.tabActive]}
          onPress={() => setActiveTab("settings")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "settings" && styles.tabTextActive,
            ]}
          >
            {t("chefProfile", "tabManagement")}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
      >
        {activeTab === "profile" ? (
          <>
            <View style={styles.profileCard}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatar}>
                  {user?.name?.charAt(0).toUpperCase() || "?"}
                </Text>
              </View>
              <Text style={styles.profileName}>
                {user?.name || t("common", "unknown")}
              </Text>
              <Text style={styles.profileRole}>
                {t("chefProfile", "accountBadge")}
              </Text>
              <Text style={styles.profileUsername}>@{user?.username}</Text>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>
                  {t("chefProfile", "statsDrivers")}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>
                  {t("chefProfile", "statsOrders")}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>0 km</Text>
                <Text style={styles.statLabel}>
                  {t("chefProfile", "statsDistance")}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.settingsSection}>
              <Text style={styles.sectionTitle}>
                {t("chefProfile", "createDriverTitle")}
              </Text>
              <Text style={styles.sectionDescription}>
                {t("chefProfile", "createDriverDesc")}
              </Text>

              <TextInput
                style={styles.input}
                placeholder={t("chefProfile", "driverNamePlaceholder")}
                value={driverName}
                onChangeText={setDriverName}
                editable={!isCreating}
              />

              <TextInput
                style={styles.input}
                placeholder={t("chefProfile", "usernamePlaceholder")}
                value={driverUsername}
                onChangeText={setDriverUsername}
                editable={!isCreating}
                autoCapitalize="none"
              />

              <TextInput
                style={styles.input}
                placeholder={t("chefProfile", "passwordPlaceholder")}
                value={driverPassword}
                onChangeText={setDriverPassword}
                secureTextEntry
                editable={!isCreating}
                autoCapitalize="none"
              />

              <Pressable
                style={[
                  styles.createButton,
                  isCreating && styles.buttonDisabled,
                ]}
                onPress={handleCreateDriver}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.createButtonText}>
                    {t("chefProfile", "createDriverButton")}
                  </Text>
                )}
              </Pressable>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.sectionTitle}>
                {t("chefProfile", "accountSection")}
              </Text>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>
                  {t("chefProfile", "usernameLabel")}
                </Text>
                <Text style={styles.settingValue}>{user?.username}</Text>
              </View>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>
                  {t("chefProfile", "roleLabel")}
                </Text>
                <Text style={styles.settingValue}>
                  {t("chefProfile", "roleValue")}
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.lightGray,
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: Colors.ui.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: "500",
    color: Colors.ui.darkGray,
  },
  tabTextActive: {
    color: Colors.ui.primary,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 24,
  },
  profileCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.ui.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
  },
  profileName: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
    color: Colors.ui.charcoal,
  },
  profileRole: {
    fontSize: 14,
    color: Colors.ui.darkGray,
    marginBottom: 8,
  },
  profileUsername: {
    fontSize: 13,
    color: Colors.ui.darkGray,
    fontStyle: "italic",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.ui.lightGray,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.ui.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.ui.darkGray,
  },
  settingsSection: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
    color: Colors.ui.charcoal,
  },
  sectionDescription: {
    fontSize: 13,
    color: Colors.ui.darkGray,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
    color: Colors.ui.charcoal,
  },
  createButton: {
    backgroundColor: Colors.ui.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  createButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  settingItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingLabel: {
    fontSize: 14,
    color: Colors.ui.darkGray,
  },
  settingValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.ui.charcoal,
  },
});
