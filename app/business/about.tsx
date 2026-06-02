import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function AboutScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={["#1a1a3e", "#0f0f2e"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backBtn}>← Zurück</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Über uns</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      {/* Content */}
      <LinearGradient
        colors={["#1a1a3e", "#2d1b4e"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.content}
      >
        <View style={styles.section}>
          <Text style={styles.title}>Über dieses Projekt</Text>
          <Text style={styles.text}>
            Dies ist ein Diplomarbeit-Projekt der HAK Judenburg, Österreich.
            Unser Team entwickelt eine moderne Logistik- und
            Liefermanagementplattform für unser abschließendes Schulprojekt.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Unser Team</Text>
          <Text style={styles.text}>
            Dieses Projekt wird von drei Schülern der HAK Judenburg entwickelt:
          </Text>
          <Text style={styles.bulletPoint}>👤 Leon</Text>
          <Text style={styles.bulletPoint}>👤 Simon</Text>
          <Text style={styles.bulletPoint}>👤 Christian</Text>
          <Text style={styles.bulletPoint}>
            Diese drei Schüler bilden das LSC ITSolutions Team.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Projektziel</Text>
          <Text style={styles.text}>
            Entwicklung einer effizienten, modernen und benutzerfreundlichen
            Logistik- und Liefermanagementplattform, die unsere Fähigkeiten in
            der Full-Stack-Web- und Mobilentwicklung mit React Native und Expo
            demonstriert.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Technologie-Stack</Text>
          <Text style={styles.bulletPoint}>✓ React Native & Expo</Text>
          <Text style={styles.bulletPoint}>✓ TypeScript</Text>
          <Text style={styles.bulletPoint}>✓ Modernes UI/UX Design</Text>
          <Text style={styles.bulletPoint}>✓ Responsives Layout</Text>
          <Text style={styles.bulletPoint}>
            ✓ Plattformübergreifende Kompatibilität
          </Text>
        </View>
      </LinearGradient>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a3e",
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
