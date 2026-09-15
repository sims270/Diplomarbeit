import { FluidPressable } from "@/components/fluid/FluidPressable";
import { PageMeta } from "@/components/page-meta";
import { Colors, Gradients, Layout, Radius, Spacing, Typography } from "@/constants/theme";
import { type AppTheme, useThemedStyles } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function ContactScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <ScrollView style={styles.container}>
      <PageMeta
        title={t("seo", "contactTitle")}
        description={t("seo", "contactDescription")}
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
          <Text style={styles.headerTitle}>{t("contact", "headerTitle")}</Text>
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
        <Text style={styles.title}>{t("contact", "title")}</Text>
        <Text style={styles.subtitle}>
          {t("contact", "subtitle")}
        </Text>

        <View style={styles.contactInfo}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>{t("contact", "emailLabel")}</Text>
            <Text style={styles.infoValue}>simon.reiter@hakju.at</Text>
          </View>
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
      paddingBottom: Spacing.xxl,
    },
    title: {
      ...readable,
      ...(isTablet ? Typography.title1 : Typography.title2),
      color: '#FFFFFF',
      marginBottom: Spacing.xs,
    },
    subtitle: {
      ...readable,
      ...Typography.callout,
      color: 'rgba(255,255,255,0.85)',
      marginBottom: Spacing.xl,
    },
    contactInfo: {
      ...readable,
      padding: Spacing.md,
      borderRadius: Radius.lg,
      backgroundColor: 'rgba(255,255,255,0.08)',
      marginBottom: Spacing.xl,
    },
    infoItem: {
      paddingVertical: Spacing.sm,
    },
    infoLabel: {
      ...Typography.caption1,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.7)',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: Spacing.xxs,
    },
    infoValue: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '500',
    },
  });
