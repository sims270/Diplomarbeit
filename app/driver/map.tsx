import { Header } from "@/components/header";
import { Colors } from "@/constants/theme";
import { StyleSheet, Text, View } from "react-native";

export default function DriverMapScreen() {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.lightGray,
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: Colors.ui.darkGray,
    textAlign: "center",
  },
});
