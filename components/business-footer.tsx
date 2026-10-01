import { FluidPressable } from "@/components/fluid/FluidPressable";
import { COMPANY_NAME } from "@/constants/company";
import { Layout, Spacing, Typography } from "@/constants/theme";
import { type AppTheme, useThemedStyles } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

/**
 * Fußzeile der öffentlichen Seiten mit den Pflichtlinks zu Impressum und
 * Datenschutzerklärung. Sie steht nur im öffentlichen Bereich — im
 * angemeldeten Teil der App gibt es keine Impressumspflicht.
 */
export function BusinessFooter() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View style={styles.footer}>
      <View style={styles.inner}>
        <View style={styles.links}>
          <FluidPressable
            style={styles.linkButton}
            onPress={() => router.push("/business/impressum")}
            accessibilityRole="link"
          >
            <Text style={styles.link}>{t("footer", "imprint")}</Text>
          </FluidPressable>

          <Text style={styles.divider}>|</Text>

          <FluidPressable
            style={styles.linkButton}
            onPress={() => router.push("/business/datenschutz")}
            accessibilityRole="link"
          >
            <Text style={styles.link}>{t("footer", "privacy")}</Text>
          </FluidPressable>
        </View>

        <Text style={styles.credit}>
          {t("footer", "developedBy")} <Text style={styles.creditName}>{COMPANY_NAME}</Text>
        </Text>
      </View>
    </View>
  );
}

const createStyles = ({ c, gutter, sideInset, isDesktop }: AppTheme) =>
  StyleSheet.create({
    footer: {
      backgroundColor: c.barSolid,
      paddingHorizontal: isDesktop ? sideInset(Layout.wideMaxWidth) : gutter,
      paddingVertical: Spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.separator,
    },
    inner: {
      width: "100%",
      maxWidth: Layout.wideMaxWidth,
      alignSelf: "center",
    },
    links: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: Spacing.xs,
    },
    linkButton: {
      minHeight: Layout.minTouch,
      justifyContent: "center",
    },
    link: {
      ...Typography.subhead,
      fontWeight: "600",
      color: c.text,
    },
    divider: {
      ...Typography.subhead,
      color: c.textTertiary,
    },
    credit: {
      ...Typography.footnote,
      color: c.textSecondary,
    },
    creditName: {
      fontWeight: "700",
      color: c.text,
    },
  });
