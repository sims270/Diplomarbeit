import { useStackScreenOptions } from '@/lib/motion/useStackScreenOptions';
import { Stack } from 'expo-router';

export default function BusinessLayout() {
  const stackOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={{ headerShown: false, ...stackOptions }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="about" />
      <Stack.Screen name="services" />
      <Stack.Screen name="contact" />
    </Stack>
  );
}
