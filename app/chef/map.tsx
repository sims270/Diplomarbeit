import { Header } from "@/components/header";
import { Colors } from "@/constants/theme";
import { useTranslation } from "@/hooks/use-translation";
import { StyleSheet, Text, View } from "react-native";

export default function MapScreen() {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.lightGray,
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 32,
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: Colors.ui.darkGray,
  },
});
