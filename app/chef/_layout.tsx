import { homeRouteFor, useAuth } from '@/app/context/AuthContext';
import { useStackScreenOptions } from '@/lib/motion/useStackScreenOptions';
import { Redirect, Stack } from 'expo-router';

export default function ChefLayout() {
  const stackOptions = useStackScreenOptions();
  const { user, isLoading } = useAuth();

  // Im Web ist /chef direkt aufrufbar. Die Daten schützt RLS ohnehin, aber
  // weder ein Fahrer noch ein nicht angemeldeter Besucher soll die
  // Chef-Oberfläche zu sehen bekommen.
  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== 'boss') {
    return <Redirect href={homeRouteFor(user.role)} />;
  }

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
