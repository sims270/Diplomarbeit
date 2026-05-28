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
            <Text style={styles.backBtn}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>About Us</Text>
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
          <Text style={styles.title}>About This Project</Text>
          <Text style={styles.text}>
            This is a Diplomarbeit (Diploma Thesis) project from HAK Judenburg,
            Austria. Our team is developing a modern logistics and delivery
            management platform for our final school project.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Our Team</Text>
          <Text style={styles.text}>
            This project is being developed by three students from HAK
            Judenburg:
          </Text>
          <Text style={styles.bulletPoint}>👤 Leon</Text>
          <Text style={styles.bulletPoint}>👤 Simon</Text>
          <Text style={styles.bulletPoint}>👤 Christian</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Project Goal</Text>
          <Text style={styles.text}>
            To create an efficient, modern, and user-friendly logistics and
            delivery management platform that demonstrates our skills in
            full-stack web and mobile development using React Native and Expo.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Technology Stack</Text>
          <Text style={styles.bulletPoint}>✓ React Native & Expo</Text>
          <Text style={styles.bulletPoint}>✓ TypeScript</Text>
          <Text style={styles.bulletPoint}>✓ Modern UI/UX Design</Text>
          <Text style={styles.bulletPoint}>✓ Responsive Layout</Text>
          <Text style={styles.bulletPoint}>✓ Cross-platform Compatibility</Text>
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
