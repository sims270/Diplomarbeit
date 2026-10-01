import { FluidPressable } from "@/components/fluid/FluidPressable";
import { Layout, pageGradients, Spacing, Typography } from "@/constants/theme";
import { type AppTheme, useAppTheme, useThemedStyles } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

/** Seite, die gerade offen ist — ihr Menüpunkt wird rot hervorgehoben. */
export type PublicPage = "login" | "about" | "services" | "contact";

/**
 * Kopfzeile aller öffentlichen Seiten: links das Logo, das zur Startseite
 * führt, rechts das Menü. Dadurch sieht jede Seite gleich aus und man kommt
 * von überall zurück zum Anfang.
 */
export function PublicHeader({ active }: { active?: PublicPage }) {
  const styles = useThemedStyles(createStyles);
  const { scheme } = useAppTheme();
  const gradients = pageGradients(scheme);
  const router = useRouter();
  const { t } = useTranslation();

  const links: { page: PublicPage; label: string; href: string }[] = [
    { page: "login", label: t("home", "navLogin"), href: "/(auth)/login" },
    { page: "about", label: t("home", "navAbout"), href: "/business/about" },
    { page: "services", label: t("home", "navGoals"), href: "/business/services" },
    { page: "contact", label: t("home", "navContact"), href: "/business/contact" },
  ];

  return (
    <LinearGradient
      colors={gradients.header}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <View style={styles.headerContent}>
        <FluidPressable
          onPress={() => router.push("/")}
          accessibilityRole="link"
          accessibilityLabel={t("common", "appName")}
        >
          <Image
            source={require("@/assets/images/logo_bg.png")}
            style={styles.logoImage}
          />
        </FluidPressable>

        <View style={styles.navLinks}>
          {links.map((link, index) => (
            <React.Fragment key={link.page}>
              {index > 0 && <Text style={styles.navDivider}>|</Text>}
              <FluidPressable
                onPress={() => router.push(link.href as never)}
                accessibilityRole="link"
              >
                <Text
                  style={[styles.navLink, active === link.page && styles.navLinkActive]}
                >
                  {link.label}
                </Text>
              </FluidPressable>
            </React.Fragment>
          ))}
        </View>
      </View>
    </LinearGradient>
  );
}

const createStyles = ({ c, isTablet, isDesktop, gutter, sideInset }: AppTheme) =>
  StyleSheet.create({
    header: {
      paddingHorizontal: isDesktop ? sideInset(Layout.wideMaxWidth) : gutter,
      // Kein zusätzlicher Abstand: Die Höhe der Leiste ergibt sich allein
      // aus dem Logo, das unverändert groß bleibt.
      paddingVertical: 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    headerContent: {
      width: "100%",
      maxWidth: Layout.wideMaxWidth,
      alignSelf: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      alignItems: "center",
      columnGap: Spacing.md,
    },
    logoImage: {
      width: isTablet ? 88 : 64,
      height: isTablet ? 88 : 64,
      resizeMode: "contain",
    },
    navLinks: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      columnGap: isTablet ? Spacing.md : Spacing.xxs,
    },
    navLink: {
      ...Typography.subhead,
      fontWeight: "500",
      color: c.text,
      opacity: 0.9,
      minHeight: Layout.minTouch,
      lineHeight: Layout.minTouch,
      paddingHorizontal: Spacing.xxs,
    },
    navLinkActive: {
      color: c.tint,
      fontWeight: "700",
      opacity: 1,
    },
    navDivider: {
      color: c.textTertiary,
    },
  });
