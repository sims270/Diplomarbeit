import { Gradients } from "@/constants/theme";
import { useTranslation } from "@/hooks/use-translation";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function AboutScreen() {
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
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backBtn}>← {t("common", "back")}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{t("about", "headerTitle")}</Text>
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
        <View style={styles.section}>
          <Text style={styles.title}>{t("about", "section1Title")}</Text>
          <Text style={styles.text}>{t("about", "section1Text")}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>{t("about", "section2Title")}</Text>
          <Text style={styles.text}>{t("about", "section2Text")}</Text>
          <Text style={styles.bulletPoint}>👤 Leon</Text>
          <Text style={styles.bulletPoint}>👤 Simon</Text>
          <Text style={styles.bulletPoint}>👤 Christian</Text>
          <Text style={styles.bulletPoint}>{t("about", "teamNote")}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>{t("about", "section3Title")}</Text>
          <Text style={styles.text}>{t("about", "section3Text")}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>{t("about", "section4Title")}</Text>
          <Text style={styles.bulletPoint}>{t("about", "tech1")}</Text>
          <Text style={styles.bulletPoint}>{t("about", "tech2")}</Text>
          <Text style={styles.bulletPoint}>{t("about", "tech3")}</Text>
          <Text style={styles.bulletPoint}>{t("about", "tech4")}</Text>
          <Text style={styles.bulletPoint}>{t("about", "tech5")}</Text>
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
  section: {
    marginBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
  },
  text: {
    fontSize: 14,
    color: "#fff",
    opacity: 0.8,
    lineHeight: 22,
  },
  bulletPoint: {
    fontSize: 14,
    color: "#fff",
    opacity: 0.8,
    marginBottom: 8,
    lineHeight: 20,
  },
});
