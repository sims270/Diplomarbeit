import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
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
        colors={["#1a1a3e", "#0f0f2e"]}
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
              <Text style={styles.navLink}>Login</Text>
            </Pressable>
            <Text style={styles.navDivider}>|</Text>
            <Pressable onPress={() => router.push("/business/about")}>
              <Text style={styles.navLink}>Über uns</Text>
            </Pressable>
            <Text style={styles.navDivider}>|</Text>
            <Pressable onPress={() => router.push("/business/services")}>
              <Text style={styles.navLink}>Ziele</Text>
            </Pressable>
            <Text style={styles.navDivider}>|</Text>
            <Pressable onPress={() => router.push("/business/contact")}>
              <Text style={styles.navLink}>Kontakt</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      {/* Hero Section */}
      <LinearGradient
        colors={["#1a1a3e", "#2d1b4e", "#8b4789", "#d946a6", "#f97316"]}
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
          <Text style={styles.mainTitle}>Willkommen</Text>
          <Text style={styles.subtitle}>
            {" "}
            Klicke auf den Button, um loszulegen
          </Text>

          <Pressable
            style={styles.seeMoreBtn}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.seeMoreText}>zum Login</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a3e",
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
    backgroundColor: "#fbbf24",
    opacity: 0.9,
    shadowColor: "#fbbf24",
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
    backgroundColor: "#1a1a3e",
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
