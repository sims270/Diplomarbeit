import { Gradients } from "@/constants/theme";
import { useTranslation } from "@/hooks/use-translation";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function ServicesScreen() {
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
      {/* Header */}
      <LinearGradient
        colors={Gradients.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backBtn}>← {t("common", "back")}</Text>
          </Pressable>
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
    marginBottom: 24,
  },
  servicesGrid: {
    gap: 16,
  },
  serviceCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  serviceDescription: {
    fontSize: 13,
    color: "#fff",
    opacity: 0.7,
    lineHeight: 18,
  },
});
