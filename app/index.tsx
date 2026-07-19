import { Colors, Gradients } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "@/hooks/use-translation";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function WelcomeScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (user?.role === "boss") {
        router.replace("/chef");
      } else {
        router.replace("/driver");
      }
    }
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: Colors[colorScheme ?? "light"].background,
        }}
      >
        <ActivityIndicator
          size="large"
          color={Colors[colorScheme ?? "light"].tint}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} scrollEnabled={false}>
      {/* Header Navigation */}
      <LinearGradient
        colors={Gradients.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Image
            source={require("@/assets/images/logo_bg.png")}
            style={styles.logoImage}
          />{" "}
          <View style={styles.navLinks}>
            <Pressable onPress={() => router.push("/login")}>
              <Text style={styles.navLink}>{t("home", "navLogin")}</Text>
            </Pressable>
            <Text style={styles.navDivider}>|</Text>
            <Pressable onPress={() => router.push("/business/about")}>
              <Text style={styles.navLink}>{t("home", "navAbout")}</Text>
            </Pressable>
            <Text style={styles.navDivider}>|</Text>
            <Pressable onPress={() => router.push("/business/services")}>
              <Text style={styles.navLink}>{t("home", "navGoals")}</Text>
            </Pressable>
            <Text style={styles.navDivider}>|</Text>
            <Pressable onPress={() => router.push("/business/contact")}>
              <Text style={styles.navLink}>{t("home", "navContact")}</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      {/* Hero Section */}
      <LinearGradient
        colors={Gradients.hero}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.hero}
      >
        {/* Sun/Moon */}
        <View style={styles.sunContainer}>
          <View style={styles.sun} />
        </View>

        {/* Mountain Silhouettes */}
        <View style={styles.mountains}>
          <View style={[styles.mountain, styles.mountain1]} />
          <View style={[styles.mountain, styles.mountain2]} />
          <View style={[styles.mountain, styles.mountain3]} />
          <View style={[styles.mountain, styles.mountain4]} />
          <View style={[styles.mountain, styles.mountain5]} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.mainTitle}>{t("home", "heroTitle")}</Text>
          <Text style={styles.subtitle}>
            {" "}
            {t("home", "heroSubtitle")}
          </Text>

          <Pressable
            style={styles.seeMoreBtn}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.seeMoreText}>{t("home", "heroButton")}</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A1A1A",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logoImage: {
    width: 40,
    height: 40,
    resizeMode: "contain",
  },
  navLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  navLink: {
    fontSize: 13,
    color: "#fff",
    opacity: 0.8,
  },
  navDivider: {
    color: "#fff",
    opacity: 0.5,
  },
  hero: {
    height: 600,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 60,
    position: "relative",
    overflow: "hidden",
  },
  sunContainer: {
    position: "absolute",
    top: "25%",
    zIndex: 1,
  },
  sun: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#9b2321",
    opacity: 0.9,
    shadowColor: "#9b2321",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 10,
  },
  mountains: {
    position: "absolute",
    bottom: 0,
    width: "120%",
    height: "50%",
    zIndex: 2,
  },
  mountain: {
    position: "absolute",
    bottom: 0,
    backgroundColor: "#1A1A1A",
  },
  mountain1: {
    left: -50,
    width: 200,
    height: 250,
    borderTopLeftRadius: 500,
    borderTopRightRadius: 500,
  },
  mountain2: {
    left: 50,
    width: 280,
    height: 200,
    borderTopLeftRadius: 500,
    borderTopRightRadius: 500,
  },
  mountain3: {
    right: -50,
    width: 250,
    height: 220,
    borderTopLeftRadius: 500,
    borderTopRightRadius: 500,
  },
  mountain4: {
    left: 150,
    width: 220,
    height: 180,
    borderTopLeftRadius: 500,
    borderTopRightRadius: 500,
    opacity: 0.8,
  },
  mountain5: {
    right: 150,
    width: 200,
    height: 200,
    borderTopLeftRadius: 500,
    borderTopRightRadius: 500,
    opacity: 0.8,
  },
  content: {
    alignItems: "center",
    zIndex: 3,
  },
  mainTitle: {
    fontSize: 64,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#fff",
    opacity: 0.8,
    marginBottom: 32,
  },
  seeMoreBtn: {
    borderWidth: 2,
    borderColor: "#fff",
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 4,
  },
  seeMoreText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
});
