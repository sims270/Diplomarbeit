import { Header } from "@/components/header";
import { Spacing, Typography } from "@/constants/theme";
import { type AppTheme, useThemedStyles } from "@/hooks/use-app-theme";
import { uiStyles } from "@/constants/ui-styles";
import { StyleSheet, Text, View } from "react-native";

export default function DriverMapScreen() {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle="Driver map" code="DR" />
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Map view</Text>
        <Text style={styles.placeholderSubtext}>
          The driver map screen is ready for future location features.
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
