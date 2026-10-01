import { BusinessFooter } from "@/components/business-footer";
import { PageMeta } from "@/components/page-meta";
import { PublicHeader } from "@/components/public-header";
import { pageGradients, Layout, Radius, shadow, Spacing, Typography } from "@/constants/theme";
import { type AppTheme, useAppTheme, useThemedStyles } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { LinearGradient } from "expo-linear-gradient";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function ServicesScreen() {
  const styles = useThemedStyles(createStyles);
  const { scheme } = useAppTheme();
  const gradients = pageGradients(scheme);
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

      <PublicHeader active="services" />

      {/* Content */}
      <LinearGradient
        colors={gradients.content}
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

      <BusinessFooter />
    </ScrollView>
  );
}

// Business-Seiten gehören zur dunklen Markenoptik der Startseite und sehen
// in beiden Modi gleich aus. Inhalte stehen auf breiten Bildschirmen in
// einer lesbaren, mittigen Spalte.
const readable = { width: '100%', maxWidth: 1120 } as const;

const createStyles = ({ c, scheme, isTablet, gutter }: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      paddingHorizontal: gutter,
      paddingVertical: Spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
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
      color: c.text,
      minHeight: Layout.minTouch,
      lineHeight: Layout.minTouch,
      paddingRight: Spacing.xs,
    },
    headerTitle: {
      ...Typography.headline,
      color: c.text,
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
      color: c.text,
      marginBottom: Spacing.xs,
    },
    subtitle: {
      ...readable,
      ...Typography.callout,
      color: c.textSecondary,
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
      backgroundColor: c.surface,
      ...shadow(1, scheme),
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator,
    },
    serviceTitle: {
      ...Typography.headline,
      color: c.text,
      marginBottom: Spacing.xs,
    },
    serviceDescription: {
      ...Typography.subhead,
      color: c.textSecondary,
    },
  });
