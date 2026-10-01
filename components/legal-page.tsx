import { BusinessFooter } from "@/components/business-footer";
import { PageMeta } from "@/components/page-meta";
import { PublicHeader } from "@/components/public-header";
import { LEGAL_LAST_UPDATED } from "@/constants/company";
import { pageGradients, Layout, Spacing, Typography } from "@/constants/theme";
import { type AppTheme, useAppTheme, useThemedStyles } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export interface LegalSection {
  heading: string;
  /** Absätze; eine Zeile je Eintrag. */
  paragraphs?: string[];
  /** Aufzählung mit Punkten. */
  bullets?: string[];
  /** Block ohne Abstand zwischen den Zeilen, z. B. eine Anschrift. */
  lines?: string[];
}

interface LegalPageProps {
  metaTitle: string;
  metaDescription: string;
  title: string;
  intro?: string;
  sections: LegalSection[];
}

/**
 * Gemeinsames Gerüst für Impressum und Datenschutzerklärung: gleicher
 * Aufbau, gleiche Typografie, dieselbe dunkle Markenoptik wie die übrigen
 * öffentlichen Seiten.
 */
export function LegalPage({
  metaTitle,
  metaDescription,
  title,
  intro,
  sections,
}: LegalPageProps) {
  const styles = useThemedStyles(createStyles);
  const { scheme } = useAppTheme();
  const gradients = pageGradients(scheme);
  const { t } = useTranslation();
  const germanOnlyNote = t("legal", "germanOnlyNote");

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <PageMeta title={metaTitle} description={metaDescription} />

      <PublicHeader />

      {/* Content */}
      <LinearGradient
        colors={gradients.content}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.content}
      >
        <Text style={styles.title}>{title}</Text>

        {/* Die Rechtstexte liegen nur auf Deutsch vor — im englischen Modus
            steht deshalb ein Hinweis darüber. */}
        {germanOnlyNote ? <Text style={styles.note}>{germanOnlyNote}</Text> : null}

        {intro ? <Text style={styles.intro}>{intro}</Text> : null}

        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>

            {section.lines?.map((line) => (
              <Text key={line} style={styles.line}>
                {line}
              </Text>
            ))}

            {section.paragraphs?.map((paragraph) => (
              <Text key={paragraph} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}

            {section.bullets?.map((bullet) => (
              <View key={bullet} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.updated}>
          {t("legal", "lastUpdated")} {LEGAL_LAST_UPDATED}
        </Text>
      </LinearGradient>

      <BusinessFooter />
    </ScrollView>
  );
}

const readable = { width: "100%", maxWidth: 720 } as const;

const createStyles = ({ c, scheme, isTablet, gutter }: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    scrollContent: {
      flexGrow: 1,
    },
    header: {
      paddingHorizontal: gutter,
      paddingVertical: Spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    headerContent: {
      width: "100%",
      maxWidth: 720,
      alignSelf: "center",
      minHeight: Layout.minTouch,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: Spacing.sm,
    },
    backBtn: {
      ...Typography.body,
      color: c.text,
      minHeight: Layout.minTouch,
      lineHeight: Layout.minTouch,
      paddingRight: Spacing.xs,
    },
    headerTitle: {
      ...Typography.headline,
      color: c.text,
      flexShrink: 1,
      textAlign: "center",
    },
    content: {
      flexGrow: 1,
      alignItems: "center",
      paddingHorizontal: gutter,
      paddingTop: isTablet ? Spacing.xl : Spacing.lg,
      paddingBottom: Spacing.xxl,
    },
    title: {
      ...readable,
      ...(isTablet ? Typography.largeTitle : Typography.title1),
      color: c.text,
      marginBottom: Spacing.md,
    },
    note: {
      ...readable,
      ...Typography.footnote,
      color: c.textSecondary,
      fontStyle: "italic",
      marginBottom: Spacing.md,
    },
    intro: {
      ...readable,
      ...Typography.callout,
      lineHeight: 26,
      color: c.textSecondary,
      marginBottom: Spacing.lg,
    },
    section: {
      ...readable,
      marginBottom: Spacing.lg,
    },
    heading: {
      ...Typography.headline,
      color: c.text,
      marginBottom: Spacing.xs,
    },
    paragraph: {
      ...Typography.callout,
      lineHeight: 26,
      color: c.textSecondary,
      marginBottom: Spacing.xs,
    },
    /** Zeilen ohne Abstand dazwischen, etwa eine Anschrift */
    line: {
      ...Typography.callout,
      lineHeight: 26,
      color: c.textSecondary,
    },
    bulletRow: {
      flexDirection: "row",
      gap: Spacing.xs,
      marginBottom: Spacing.xxs,
    },
    bulletDot: {
      ...Typography.callout,
      lineHeight: 26,
      color: c.textTertiary,
    },
    bulletText: {
      ...Typography.callout,
      lineHeight: 26,
      color: c.textSecondary,
      flex: 1,
    },
    updated: {
      ...readable,
      ...Typography.footnote,
      color: c.textTertiary,
      marginTop: Spacing.xs,
    },
  });
