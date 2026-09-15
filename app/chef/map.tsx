import { Header } from "@/components/header";
import { Spacing, Typography } from "@/constants/theme";
import { type AppTheme, useThemedStyles } from "@/hooks/use-app-theme";
import { uiStyles } from "@/constants/ui-styles";
import { useTranslation } from "@/hooks/use-translation";
import { StyleSheet, Text, View } from "react-native";

export default function MapScreen() {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t("chefMap", "headerSubtitle")} code="CH" />
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>{t("chefMap", "placeholderTitle")}</Text>
        <Text style={styles.placeholderSubtext}>
          {t("chefMap", "placeholderSubtext")}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    container: u.screen,
    placeholder: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
    },
    placeholderText: {
      ...Typography.title2,
      color: c.text,
      marginBottom: Spacing.xs,
      textAlign: 'center',
    },
    placeholderSubtext: {
      ...Typography.subhead,
      color: c.textSecondary,
      textAlign: 'center',
    },
  });
};
