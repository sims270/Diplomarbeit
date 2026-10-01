import { BusinessFooter } from "@/components/business-footer";
import { FluidPressable } from "@/components/fluid/FluidPressable";
import { HeroPreview } from "@/components/hero-preview";
import { PageMeta } from "@/components/page-meta";
import { PublicHeader } from "@/components/public-header";
import { Colors, Layout, pageGradients, Radius, Spacing, Typography } from "@/constants/theme";
import { type AppTheme, useAppTheme, useThemedStyles } from "@/hooks/use-app-theme";
import { useAuth } from "@/app/context/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "@/hooks/use-translation";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function WelcomeScreen() {
  const styles = useThemedStyles(createStyles);
  const { scheme } = useAppTheme();
  const gradients = pageGradients(scheme);
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
    // Scrollen bleibt an: In niedrigen Fenstern waren sonst der
    // Login-Button und die Fußzeile mit Impressum und Datenschutz
    // nicht erreichbar.
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {meta}

      <PublicHeader />

      {/* Hero: ruhiger Verlauf, Produktname, Nutzen und zwei Wege weiter */}
      <LinearGradient
        colors={gradients.content}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.content}>
          <View style={styles.textColumn}>
            <Text style={styles.eyebrow}>{t("home", "heroEyebrow")}</Text>
            <Text style={styles.mainTitle}>{t("home", "heroTitle")}</Text>
            <Text style={styles.subtitle}>{t("home", "heroSubtitle")}</Text>

            <View style={styles.actions}>
              <FluidPressable
                style={styles.primaryBtn}
                onPress={() => router.push("/(auth)/login")}
              >
                <Text style={styles.primaryText}>{t("home", "heroButton")}</Text>
              </FluidPressable>

              <FluidPressable
                style={styles.secondaryBtn}
                onPress={() => router.push("/business/about")}
              >
                <Text style={styles.secondaryText}>
                  {t("home", "heroSecondaryButton")}
                </Text>
              </FluidPressable>
            </View>
          </View>

          <HeroPreview style={styles.preview} />
        </View>
      </LinearGradient>

      <BusinessFooter />
    </ScrollView>
  );
}

const createStyles = ({ c, isTablet, isDesktop, gutter, sideInset }: AppTheme) => {
  const inset = isDesktop ? sideInset(Layout.wideMaxWidth) : gutter;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    scrollContent: {
      flexGrow: 1,
    },
    header: {
      paddingHorizontal: inset,
      paddingVertical: Spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
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
      width: isTablet ? 88 : 64,
      height: isTablet ? 88 : 64,
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
      color: c.text,
      opacity: 0.9,
      minHeight: Layout.minTouch,
      lineHeight: Layout.minTouch,
      paddingHorizontal: Spacing.xxs,
    },
    navDivider: {
      color: c.textTertiary,
    },
    hero: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: inset,
      paddingVertical: isDesktop ? 96 : Spacing.xxl,
    },
    content: {
      width: '100%',
      maxWidth: Layout.wideMaxWidth,
      alignSelf: 'center',
      // Ab Laptop stehen Text und Produktansicht nebeneinander
      flexDirection: isDesktop ? 'row' : 'column',
      alignItems: 'center',
      gap: isDesktop ? Spacing.xxl : Spacing.xl,
    },
    textColumn: {
      flex: isDesktop ? 1 : undefined,
      width: '100%',
      maxWidth: 560,
      // Am Handy mittig, ab Tablet linksbündig wie auf Produktseiten üblich
      alignItems: isTablet ? 'flex-start' : 'center',
    },
    preview: {
      flex: isDesktop ? 1 : undefined,
      width: '100%',
      maxWidth: 560,
    },
    /** Kleine Zeile über dem Titel, ordnet das Produkt ein */
    eyebrow: {
      ...Typography.footnote,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: c.tint,
      marginBottom: Spacing.sm,
      textAlign: isTablet ? 'left' : 'center',
    },
    mainTitle: {
      fontSize: isDesktop ? 60 : isTablet ? 48 : 36,
      lineHeight: isDesktop ? 66 : isTablet ? 54 : 42,
      fontWeight: '800',
      letterSpacing: isTablet ? -1 : -0.5,
      color: c.text,
      textAlign: isTablet ? 'left' : 'center',
      marginBottom: Spacing.md,
    },
    subtitle: {
      ...(isTablet ? Typography.title3 : Typography.callout),
      fontWeight: '400',
      lineHeight: isTablet ? 32 : 26,
      color: c.textSecondary,
      maxWidth: 680,
      textAlign: isTablet ? 'left' : 'center',
      marginBottom: Spacing.xl,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      justifyContent: isTablet ? 'flex-start' : 'center',
    },
    primaryBtn: {
      minHeight: 52,
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
      borderRadius: Radius.md + 2,
      backgroundColor: c.tintFill,
    },
    primaryText: {
      ...Typography.headline,
      color: c.onTint,
    },
    secondaryBtn: {
      minHeight: 52,
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
      borderRadius: Radius.md + 2,
      borderWidth: 1,
      borderColor: c.separator,
      backgroundColor: c.surface,
    },
    secondaryText: {
      ...Typography.headline,
      color: c.text,
    },
  });
};
