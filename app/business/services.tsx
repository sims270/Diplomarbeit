import { FluidPressable } from "@/components/fluid/FluidPressable";
import { PageMeta } from "@/components/page-meta";
import { Colors, Gradients, Layout, Radius, Spacing, Typography } from "@/constants/theme";
import { type AppTheme, useThemedStyles } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function ServicesScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { t } = useTranslation();

  const services = [
    { title: t("services", "service1Title"), description: t("services", "service1Desc") },
    { title: t("services", "service2Title"), description: t("services", "service2Desc") },
    { title: t("services", "service3Title"), description: t("services", "service3Desc") },
    { title: t("services", "service4Title"), description: t("services", "service4Desc") },
    { title: t("services", "service5Title"), description: t("services", "service5Desc") },
    { title: t("services", "service6Title"), description: t("services", "service6Desc") },
  ];

  return (
    <ScrollView style={styles.container}>
      <PageMeta
        title={t("seo", "servicesTitle")}
        description={t("seo", "servicesDescription")}
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
          <Text style={styles.headerTitle}>{t("services", "headerTitle")}</Text>
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
        <Text style={styles.title}>{t("services", "title")}</Text>
        <Text style={styles.subtitle}>
          {t("services", "subtitle")}
        </Text>

        <View style={styles.servicesGrid}>
          {services.map((service, index) => (
            <View key={index} style={styles.serviceCard}>
              <Text style={styles.serviceTitle}>{service.title}</Text>
              <Text style={styles.serviceDescription}>
                {service.description}
              </Text>
            </View>
          ))}
        </View>
      </LinearGradient>
    </ScrollView>
  );
}

// Business-Seiten gehören zur dunklen Markenoptik der Startseite und sehen
// in beiden Modi gleich aus. Inhalte stehen auf breiten Bildschirmen in
// einer lesbaren, mittigen Spalte.
const readable = { width: '100%', maxWidth: 1120 } as const;

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
      maxWidth: 1120,
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
      marginBottom: Spacing.lg,
    },
    // Auf Tablet/Desktop zweispaltig
    servicesGrid: {
      ...readable,
      maxWidth: 1120,
      flexDirection: isTablet ? 'row' : 'column',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    // Glas-Karte: leicht transluzent auf dem dunklen Verlauf
    serviceCard: {
      flexGrow: 1,
      flexBasis: isTablet ? '45%' : 'auto',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    serviceTitle: {
      ...Typography.headline,
      color: '#FFFFFF',
      marginBottom: Spacing.xs,
    },
    serviceDescription: {
      ...Typography.subhead,
      color: 'rgba(255,255,255,0.8)',
    },
  });
