import { useStackScreenOptions } from '@/lib/motion/useStackScreenOptions';
import { Stack } from 'expo-router';

export default function VehiclesLayout() {
  const stackOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={{ headerShown: false, ...stackOptions }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
