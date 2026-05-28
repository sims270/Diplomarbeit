import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function ServicesScreen() {
  const router = useRouter();

  const services = [
    {
      title: "Auftragsverteilung",
      description:
        "Der Disponist teilt Aufträge direkt an Fahrer in der App zu",
    },
    {
      title: "Fahrer-Dashboard",
      description:
        "Fahrer sehen ihre zugeteilten Aufträge mit Zieladresse und Details",
    },
    {
      title: "Echtzeit-Benachrichtigungen",
      description: "Sofortige Meldungen über neue Aufträge und Änderungen",
    },
    {
      title: "Auftragsdetails",
      description: "Alle wichtigen Informationen für jeden Auftrag auf einen Blick",
    },
    {
      title: "Automatisierte Disposition",
      description:
        "Effiziente und automatisierte Verwaltung der Auftragsverteilung",
    },
    {
      title: "Benutzerfreundliche Bedienung",
      description: "Intuitive App-Oberfläche für Disponenten und Fahrer",
    },
  ];

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
          <Text style={styles.headerTitle}>Ziele</Text>
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
        <Text style={styles.title}>Projektfeatures</Text>
        <Text style={styles.subtitle}>
          Automatisiertes Dispositionssystem für effiziente Auftragsverteilung
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
