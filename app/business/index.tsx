import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

export default function BusinessIndexScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();

  useEffect(() => {
    router.replace("/business/about");
  }, [router]);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: Colors[colorScheme ?? "light"].background,
      }}
    >
      <ActivityIndicator
        size="large"
        color={Colors[colorScheme ?? "light"].tint}
      />
    </View>
  );
}
