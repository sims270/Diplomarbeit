import { useStackScreenOptions } from '@/lib/motion/useStackScreenOptions';
import { Stack } from 'expo-router';

export default function ChefLayout() {
  const stackOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={{ headerShown: false, ...stackOptions }}>
      {/* Dashboard, Tankliste und Profil mit Tab-Leiste unten — app/chef/(tabs)/ */}
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="drivers" />
      <Stack.Screen name="vehicles" />
      <Stack.Screen name="external-order" />
    </Stack>
  );
}
