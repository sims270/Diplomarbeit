import { useStackScreenOptions } from '@/lib/motion/useStackScreenOptions';
import { Stack } from 'expo-router';

export default function DriverOrderLayout() {
  const stackOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={{ headerShown: false, ...stackOptions }}>
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
