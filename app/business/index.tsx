import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import React from "react";
import { LinearGradient } from "expo-linear-gradient";

export default function WelcomeScreen() {
  const router = useRouter();

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
          <Text style={styles.logo}>your logo</Text>
          <View style={styles.navLinks}>
            <Pressable onPress={() => router.push("/business")}>
              <Text style={styles.navLink}>Home</Text>
            </Pressable>
            <Text style={styles.navDivider}>|</Text>
            <Pressable onPress={() => router.push("/business/about")}>
              <Text style={styles.navLink}>About Us</Text>
            </Pressable>
            <Text style={styles.navDivider}>|</Text>
            <Pressable onPress={() => router.push("/business/services")}>
              <Text style={styles.navLink}>Services</Text>
            </Pressable>
            <Text style={styles.navDivider}>|</Text>
            <Pressable onPress={() => router.push("/business/contact")}>
              <Text style={styles.navLink}>Contact us</Text>
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
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.mainTitle}>welcome</Text>
          <Text style={styles.subtitle}>landing page design</Text>

          <Pressable
            style={styles.seeMoreBtn}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.seeMoreText}>see more</Text>
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
  logo: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
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
