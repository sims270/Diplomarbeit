import { BusinessFooter } from "@/components/business-footer";
import { PageMeta } from "@/components/page-meta";
import { PublicHeader } from "@/components/public-header";
import { TEAM } from "@/constants/company";
import { Layout, pageGradients, Radius, shadow, Spacing, Typography } from "@/constants/theme";
import { type AppTheme, useAppTheme, useThemedStyles } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function AboutScreen() {
  const styles = useThemedStyles(createStyles);
  const { scheme } = useAppTheme();
  const gradients = pageGradients(scheme);
  const { t } = useTranslation();

  // Zahlen, die sich aus dem Projekt selbst ergeben — nichts Erfundenes.
  const facts = [
    { value: String(TEAM.length), label: t("about", "factDevelopers") },
    { value: "1", label: t("about", "factCodebase") },
    { value: t("about", "factPlatformsValue"), label: t("about", "factPlatforms") },
  ];

  const tech = [
    { label: t("about", "techFrontendLabel"), value: t("about", "techFrontendValue") },
    { label: t("about", "techBackendLabel"), value: t("about", "techBackendValue") },
    { label: t("about", "techPlatformLabel"), value: t("about", "techPlatformValue") },
    { label: t("about", "techSecurityLabel"), value: t("about", "techSecurityValue") },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <PageMeta
        title={t("seo", "aboutTitle")}
        description={t("seo", "aboutDescription")}
      />

      <PublicHeader active="about" />

      <LinearGradient
        colors={gradients.content}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.content}
      >
        <View style={styles.column}>
          <Text style={styles.eyebrow}>{t("about", "eyebrow")}</Text>
          <Text style={styles.title}>{t("about", "title")}</Text>
          <Text style={styles.lead}>{t("about", "lead")}</Text>

          {/* Zahlenleiste: ordnet das Projekt in drei Werten ein */}
          <View style={styles.facts}>
            {facts.map((fact) => (
              <View key={fact.label} style={styles.fact}>
                <Text style={styles.factValue}>{fact.value}</Text>
                <Text style={styles.factLabel}>{fact.label}</Text>
              </View>
            ))}
          </View>

          {/* Ab Laptop zwei Spalten, darunter untereinander */}
          <View style={styles.grid}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t("about", "section1Title")}</Text>
              <Text style={styles.text}>{t("about", "section1Text")}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t("about", "section3Title")}</Text>
              <Text style={styles.text}>{t("about", "section3Text")}</Text>
            </View>
          </View>

          <View style={styles.wideCard}>
            <Text style={styles.cardTitle}>{t("about", "section2Title")}</Text>
            <Text style={styles.text}>{t("about", "section2Text")}</Text>

            {/* Namen aus denselben Stammdaten wie Kontakt und Impressum. */}
            <View style={styles.team}>
              {TEAM.map((person) => (
                <View key={person.email} style={styles.member}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {person.name
                        .split(" ")
                        .map((part) => part.charAt(0))
                        .join("")}
                    </Text>
                  </View>
                  <View style={styles.memberText}>
                    <Text style={styles.memberName}>{person.name}</Text>
                    <Text style={styles.memberRole}>{t("about", "teamRole")}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.wideCard}>
            <Text style={styles.cardTitle}>{t("about", "section4Title")}</Text>

            {/* Nach Bereichen gegliedert statt als Schlagwortliste */}
            {tech.map((row, index) => (
              <View
                key={row.label}
                style={[styles.techRow, index === tech.length - 1 && styles.techRowLast]}
              >
                <Text style={styles.techLabel}>{row.label}</Text>
                <Text style={styles.techValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </LinearGradient>

      <BusinessFooter />
    </ScrollView>
  );
}

const createStyles = ({ c, scheme, isTablet, isDesktop, gutter, sideInset }: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    scrollContent: {
      flexGrow: 1,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: isDesktop ? sideInset(Layout.formMaxWidth) : gutter,
      paddingTop: isTablet ? Spacing.xl : Spacing.lg,
      paddingBottom: Spacing.xxl,
    },
    column: {
      width: "100%",
      maxWidth: Layout.formMaxWidth,
      alignSelf: "center",
    },
    /** Kleine Einordnung über dem Titel, wie auf der Startseite */
    eyebrow: {
      ...Typography.footnote,
      fontWeight: "700",
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: c.tint,
      marginBottom: Spacing.xs,
    },
    title: {
      ...(isTablet ? Typography.largeTitle : Typography.title1),
      color: c.text,
      marginBottom: Spacing.sm,
    },
    lead: {
      ...(isTablet ? Typography.title3 : Typography.callout),
      fontWeight: "400",
      lineHeight: isTablet ? 30 : 26,
      color: c.textSecondary,
      maxWidth: 680,
      marginBottom: Spacing.lg,
    },
    facts: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator,
      marginBottom: Spacing.lg,
    },
    fact: {
      flexGrow: 1,
      flexBasis: 140,
    },
    factValue: {
      ...Typography.title2,
      color: c.text,
    },
    factLabel: {
      ...Typography.footnote,
      color: c.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginTop: 2,
    },
    grid: {
      flexDirection: isDesktop ? "row" : "column",
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    card: {
      flex: isDesktop ? 1 : undefined,
      backgroundColor: c.surface,
      borderRadius: Radius.lg,
      padding: isTablet ? Spacing.lg : Spacing.md,
      ...shadow(1, scheme),
    },
    wideCard: {
      backgroundColor: c.surface,
      borderRadius: Radius.lg,
      padding: isTablet ? Spacing.lg : Spacing.md,
      marginBottom: Spacing.md,
      ...shadow(1, scheme),
    },
    cardTitle: {
      ...Typography.title3,
      color: c.text,
      marginBottom: Spacing.xs,
    },
    text: {
      ...Typography.callout,
      lineHeight: 26,
      color: c.textSecondary,
    },
    team: {
      flexDirection: isTablet ? "row" : "column",
      flexWrap: "wrap",
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    member: {
      flexGrow: 1,
      flexBasis: isTablet ? 200 : "auto",
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.sm,
      borderRadius: Radius.md,
      backgroundColor: c.surfaceSecondary,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.tintFill,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      ...Typography.subhead,
      fontWeight: "700",
      color: c.onTint,
    },
    memberText: {
      flexShrink: 1,
    },
    memberName: {
      ...Typography.callout,
      fontWeight: "600",
      color: c.text,
    },
    memberRole: {
      ...Typography.footnote,
      color: c.textSecondary,
    },
    // Technik als Zeilen mit Bereichsbezeichnung — sagt mehr als Schlagworte
    techRow: {
      flexDirection: isTablet ? "row" : "column",
      alignItems: isTablet ? "flex-start" : undefined,
      gap: isTablet ? Spacing.md : 2,
      paddingVertical: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    techRowLast: {
      borderBottomWidth: 0,
      paddingBottom: 0,
    },
    techLabel: {
      ...Typography.subhead,
      fontWeight: "600",
      color: c.text,
      width: isTablet ? 160 : undefined,
    },
    techValue: {
      ...Typography.subhead,
      color: c.textSecondary,
      flex: isTablet ? 1 : undefined,
      lineHeight: 22,
    },
  });
