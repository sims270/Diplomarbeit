import { homeRouteFor, useAuth } from '@/app/context/AuthContext';
import { useStackScreenOptions } from '@/lib/motion/useStackScreenOptions';
import { Redirect, Stack } from 'expo-router';

export default function ChefLayout() {
  const stackOptions = useStackScreenOptions();
  const { user, isLoading } = useAuth();

  // Im Web ist /chef direkt aufrufbar. Die Daten schützt RLS ohnehin, aber
  // ein Fahrer soll gar nicht erst in der Chef-Oberfläche landen.
  if (!isLoading && user && user.role !== 'boss') {
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
