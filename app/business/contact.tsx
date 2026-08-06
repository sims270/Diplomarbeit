import { FluidPressable } from "@/components/fluid/FluidPressable";
import { Gradients } from "@/constants/theme";
import { useTranslation } from "@/hooks/use-translation";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function ContactScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <ScrollView style={styles.container}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A1A1A",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backBtn: {
    fontSize: 16,
    color: "#fff",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#fff",
    opacity: 0.8,
    marginBottom: 32,
  },
  contactInfo: {
    marginBottom: 32,
  },
  infoItem: {
    marginBottom: 20,
  },
  infoLabel: {
    fontSize: 12,
    color: "#fff",
    opacity: 0.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "500",
  },
});
