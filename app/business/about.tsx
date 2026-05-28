import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

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
          <Text style={styles.title}>About Our Company</Text>
          <Text style={styles.text}>
            We are a leading logistics and delivery management platform dedicated
            to revolutionizing how businesses manage their transportation and
            delivery operations.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Our Mission</Text>
          <Text style={styles.text}>
            To provide efficient, reliable, and user-friendly solutions for both
            drivers and fleet managers, ensuring seamless coordination and
            optimal delivery performance.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Our Vision</Text>
          <Text style={styles.text}>
            To become the most trusted transportation management platform,
            connecting drivers with opportunities and helping businesses scale
            their delivery operations.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Why Choose Us?</Text>
          <Text style={styles.bulletPoint}>
            ✓ Real-time tracking and updates
          </Text>
          <Text style={styles.bulletPoint}>✓ Easy-to-use interface</Text>
          <Text style={styles.bulletPoint}>
            ✓ Comprehensive analytics and reports
          </Text>
          <Text style={styles.bulletPoint}>✓ 24/7 customer support</Text>
          <Text style={styles.bulletPoint}>
            ✓ Secure and reliable platform
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
