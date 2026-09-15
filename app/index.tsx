import { FluidPressable } from "@/components/fluid/FluidPressable";
import { PageMeta } from "@/components/page-meta";
import { Colors, Gradients, Layout, Radius, Spacing, Typography } from "@/constants/theme";
import { type AppTheme, useThemedStyles } from "@/hooks/use-app-theme";
import { useAuth } from "@/app/context/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "@/hooks/use-translation";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function WelcomeScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { isLoading } = useAuth();
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  // Beim statischen Web-Export wird die Startseite im Ladezustand gerendert.
  // Die Metadaten müssen deshalb vor dem frühen Return stehen, sonst landen
  // Titel und Beschreibung nicht im exportierten HTML.
  const meta = (
    <PageMeta
      title={t("seo", "homeTitle")}
      description={t("seo", "homeDescription")}
    />
  );

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
        {meta}
        <ActivityIndicator
          size="large"
          color={Colors[colorScheme ?? "light"].tint}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} scrollEnabled={false}>
      {meta}

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
            <FluidPressable onPress={() => router.push("/(auth)/login")}>
              <Text style={styles.navLink}>{t("home", "navLogin")}</Text>
            </FluidPressable>
            <Text style={styles.navDivider}>|</Text>
            <FluidPressable onPress={() => router.push("/business/about")}>
              <Text style={styles.navLink}>{t("home", "navAbout")}</Text>
            </FluidPressable>
            <Text style={styles.navDivider}>|</Text>
            <FluidPressable onPress={() => router.push("/business/services")}>
              <Text style={styles.navLink}>{t("home", "navGoals")}</Text>
            </FluidPressable>
            <Text style={styles.navDivider}>|</Text>
            <FluidPressable onPress={() => router.push("/business/contact")}>
              <Text style={styles.navLink}>{t("home", "navContact")}</Text>
            </FluidPressable>
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

          <FluidPressable
            style={styles.seeMoreBtn}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={styles.seeMoreText}>{t("home", "heroButton")}</Text>
          </FluidPressable>
        </View>
      </LinearGradient>
    </ScrollView>
  );
}

// Die Startseite ist bewusst eine dunkle Markenseite (Schwarz → Rot) und
// sieht in Light und Dark Mode gleich aus. Angepasst werden nur Typografie,
// Touch-Ziele und die Größen je Bildschirmbreite.
const createStyles = ({ isTablet, gutter }: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.ui.charcoal,
    },
    header: {
      paddingHorizontal: gutter,
      paddingVertical: Spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(255,255,255,0.15)',
    },
    headerContent: {
      width: '100%',
      maxWidth: Layout.wideMaxWidth,
      alignSelf: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      columnGap: Spacing.md,
    },
    logoImage: {
      width: 44,
      height: 44,
      resizeMode: 'contain',
    },
    navLinks: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: isTablet ? Spacing.md : Spacing.xxs,
    },
    navLink: {
      ...Typography.subhead,
      fontWeight: '500',
      color: '#FFFFFF',
      opacity: 0.9,
      minHeight: Layout.minTouch,
      lineHeight: Layout.minTouch,
      paddingHorizontal: Spacing.xxs,
    },
    navDivider: {
      color: '#FFFFFF',
      opacity: 0.35,
    },
    hero: {
      height: isTablet ? 640 : 560,
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingBottom: isTablet ? 72 : Spacing.xxl,
      paddingHorizontal: gutter,
      position: 'relative',
      overflow: 'hidden',
    },
    sunContainer: {
      position: 'absolute',
      top: '22%',
      zIndex: 1,
    },
    sun: {
      width: isTablet ? 140 : 112,
      height: isTablet ? 140 : 112,
      borderRadius: isTablet ? 70 : 56,
      backgroundColor: Colors.ui.primary,
      opacity: 0.9,
      shadowColor: Colors.ui.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.45,
      shadowRadius: 36,
      elevation: 10,
    },
    mountains: {
      position: 'absolute',
      bottom: 0,
      width: '120%',
      height: '50%',
      zIndex: 2,
    },
    mountain: {
      position: 'absolute',
      bottom: 0,
      backgroundColor: Colors.ui.charcoal,
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
      width: '100%',
      maxWidth: 720,
      alignItems: 'center',
      zIndex: 3,
    },
    mainTitle: {
      fontSize: isTablet ? 64 : 44,
      lineHeight: isTablet ? 70 : 50,
      fontWeight: '800',
      letterSpacing: isTablet ? -1 : -0.5,
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: Spacing.xs,
    },
    subtitle: {
      ...Typography.body,
      color: '#FFFFFF',
      opacity: 0.85,
      textAlign: 'center',
      marginBottom: Spacing.xl,
    },
    // Weiße Pill im iOS-Stil — auf dem roten Verlauf klar sichtbar
    seeMoreBtn: {
      minHeight: 52,
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
      borderRadius: Radius.pill,
      backgroundColor: '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 6,
    },
    seeMoreText: {
      ...Typography.headline,
      color: '#111111',
    },
  });
