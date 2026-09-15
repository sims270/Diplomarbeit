import { FluidPressable } from "@/components/fluid/FluidPressable";
import { PageMeta } from "@/components/page-meta";
import { Colors, Gradients, Layout, Spacing, Typography } from "@/constants/theme";
import { type AppTheme, useThemedStyles } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function AboutScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <ScrollView style={styles.container}>
      <PageMeta
        title={t("seo", "aboutTitle")}
        description={t("seo", "aboutDescription")}
      />

      {/* Header */}
      <LinearGradient
        colors={Gradients.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <FluidPressable onPress={() => router.back()}>
            <Text style={styles.backBtn}>← {t("common", "back")}</Text>
          </FluidPressable>
          <Text style={styles.headerTitle}>{t("about", "headerTitle")}</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      {/* Content */}
      <LinearGradient
        colors={Gradients.content}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.content}
      >
        <View style={styles.section}>
          <Text style={styles.title}>{t("about", "section1Title")}</Text>
          <Text style={styles.text}>{t("about", "section1Text")}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>{t("about", "section2Title")}</Text>
          <Text style={styles.text}>{t("about", "section2Text")}</Text>
          <Text style={styles.bulletPoint}>👤 Leon</Text>
          <Text style={styles.bulletPoint}>👤 Simon</Text>
          <Text style={styles.bulletPoint}>👤 Christian</Text>
          <Text style={styles.bulletPoint}>{t("about", "teamNote")}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>{t("about", "section3Title")}</Text>
          <Text style={styles.text}>{t("about", "section3Text")}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>{t("about", "section4Title")}</Text>
          <Text style={styles.bulletPoint}>{t("about", "tech1")}</Text>
          <Text style={styles.bulletPoint}>{t("about", "tech2")}</Text>
          <Text style={styles.bulletPoint}>{t("about", "tech3")}</Text>
          <Text style={styles.bulletPoint}>{t("about", "tech4")}</Text>
          <Text style={styles.bulletPoint}>{t("about", "tech5")}</Text>
        </View>
      </LinearGradient>
    </ScrollView>
  );
}

// Business-Seiten gehören zur dunklen Markenoptik der Startseite und sehen
// in beiden Modi gleich aus. Inhalte stehen auf breiten Bildschirmen in
// einer lesbaren, mittigen Spalte.
const readable = { width: '100%', maxWidth: 720 } as const;

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
      maxWidth: 720,
      alignSelf: 'center',
      minHeight: Layout.minTouch,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    backBtn: {
      ...Typography.body,
      color: '#FFFFFF',
      minHeight: Layout.minTouch,
      lineHeight: Layout.minTouch,
      paddingRight: Spacing.xs,
    },
    headerTitle: {
      ...Typography.headline,
      color: '#FFFFFF',
      flexShrink: 1,
      textAlign: 'center',
    },
    content: {
      alignItems: 'center',
      paddingHorizontal: gutter,
      paddingTop: isTablet ? Spacing.xl : Spacing.lg,
      paddingBottom: Spacing.xl,
    },
    section: {
      ...readable,
      marginBottom: Spacing.xl,
    },
    title: {
      ...readable,
      ...(isTablet ? Typography.title1 : Typography.title2),
      color: '#FFFFFF',
      marginBottom: Spacing.sm,
    },
    text: {
      ...Typography.callout,
      lineHeight: 24,
      color: 'rgba(255,255,255,0.85)',
    },
    bulletPoint: {
      ...Typography.callout,
      color: 'rgba(255,255,255,0.85)',
      marginBottom: Spacing.xs,
    },
  });
