import { BusinessFooter } from "@/components/business-footer";
import { FluidPressable } from "@/components/fluid/FluidPressable";
import { PageMeta } from "@/components/page-meta";
import { PublicHeader } from "@/components/public-header";
import { pageGradients, Layout, Spacing, Typography } from "@/constants/theme";
import { type AppTheme, useAppTheme, useThemedStyles } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { LinearGradient } from "expo-linear-gradient";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";

// Kontaktdaten stehen bewusst nicht in den Übersetzungen: Namen,
// Telefonnummern und Adressen sind in jeder Sprache gleich.
const COMPANY_NAME = "LSC - ITSolutions";
const ADDRESS = ["Bundesstraße 24a", "A-8770 Stadlhof (Stmk)"];

const TEAM = [
  { name: "Simon Reiter", tel: "+43 670 201 51 35", email: "simon.reiter@hakju.at" },
  { name: "Christian Hochreiter", tel: "+43 664 154 74 79", email: "christian.hochreiter@hakju.at" },
  { name: "Leon Wedam", tel: "+43 676 432 20 20", email: "leon.wedam@hakju.at" },
];

/** Leerzeichen und Trennzeichen raus — tel: verträgt nur die reine Nummer. */
const toDialable = (number: string) => number.replace(/[^+\d]/g, "");

export default function ContactScreen() {
  const styles = useThemedStyles(createStyles);
  const { scheme } = useAppTheme();
  const gradients = pageGradients(scheme);
  const { t } = useTranslation();

  const open = (url: string) => {
    Linking.openURL(url).catch(() => {
      // Kein Mail- oder Telefonprogramm vorhanden: Die Nummer steht
      // daneben, abschreiben geht immer — ein Absturz hilft niemandem.
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <PageMeta
        title={t("seo", "contactTitle")}
        description={t("seo", "contactDescription")}
      />

      <PublicHeader active="contact" />

      {/* Content */}
      <LinearGradient
        colors={gradients.content}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.content}
      >
        <Text style={styles.title}>{COMPANY_NAME}</Text>

        <View style={styles.block}>
          {ADDRESS.map((line) => (
            <Text key={line} style={styles.text}>
              {line}
            </Text>
          ))}
        </View>

        {TEAM.map((person) => (
          <View key={person.email} style={styles.block}>
            <Text style={styles.personName}>{person.name}</Text>

            <FluidPressable
              style={styles.row}
              onPress={() => open(`tel:${toDialable(person.tel)}`)}
              accessibilityRole="link"
            >
              <Text style={styles.label}>{t("contact", "telLabel")}</Text>
              <Text style={styles.text}>{person.tel}</Text>
            </FluidPressable>

            <FluidPressable
              style={styles.row}
              onPress={() => open(`mailto:${person.email}`)}
              accessibilityRole="link"
            >
              <Text style={styles.label}>{t("contact", "emailLabel")}</Text>
              <Text style={styles.email}>{person.email}</Text>
            </FluidPressable>
          </View>
        ))}
      </LinearGradient>

      <BusinessFooter />
    </ScrollView>
  );
}

// Business-Seiten gehören zur dunklen Markenoptik der Startseite und sehen
// in beiden Modi gleich aus. Inhalte stehen auf breiten Bildschirmen in
// einer lesbaren, mittigen Spalte.
const readable = { width: '100%', maxWidth: 720 } as const;

const createStyles = ({ c, scheme, isTablet, gutter }: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    // Der Verlauf soll die ganze Seite füllen, auch wenn der Text kurz ist
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
      flexGrow: 1,
      alignItems: 'center',
      paddingHorizontal: gutter,
      paddingTop: isTablet ? Spacing.xl : Spacing.lg,
      paddingBottom: Spacing.xxl,
    },
    title: {
      ...readable,
      ...(isTablet ? Typography.largeTitle : Typography.title1),
      color: c.text,
      marginBottom: Spacing.lg,
    },
    /** Ein Ansprechpartner: Name, Telefon, E-Mail — durch Luft getrennt */
    block: {
      ...readable,
      marginBottom: Spacing.lg,
    },
    personName: {
      ...Typography.headline,
      color: c.text,
      marginBottom: Spacing.xxs,
    },
    text: {
      ...Typography.callout,
      lineHeight: 26,
      color: c.textSecondary,
    },
    /** Zeile aus Beschriftung und Wert; 44px hoch, damit sie sich gut treffen lässt */
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: Layout.minTouch,
      alignSelf: 'flex-start',
    },
    label: {
      ...Typography.callout,
      lineHeight: 26,
      color: c.textSecondary,
      width: 72,
    },
    // Rot wie im Vorbild, aber heller — auf dunklem Grund bliebe das
    // Corporate-Rot sonst unter dem Mindestkontrast.
    email: {
      ...Typography.callout,
      lineHeight: 26,
      color: c.tint,
      textDecorationLine: 'underline',
    },
  });
