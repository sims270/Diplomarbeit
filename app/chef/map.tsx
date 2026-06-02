import { Header } from "@/components/header";
import { Colors } from "@/constants/theme";
import { StyleSheet, Text, View } from "react-native";

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle="KARTE" code="CH" />
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>🗺️ Map View</Text>
        <Text style={styles.placeholderSubtext}>
          Map integration coming soon
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
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
