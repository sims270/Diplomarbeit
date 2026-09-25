import { homeRouteFor, useAuth } from '@/app/context/AuthContext';
import { useStackScreenOptions } from '@/lib/motion/useStackScreenOptions';
import { Redirect, Stack } from 'expo-router';

// Der Bereich für fremde Fahrer (Subunternehmer): nur die zugewiesenen
// Fremdaufträge, ohne Preise, mit CMR-Upload. Keine Tankliste, kein Profil.
export default function ExternalLayout() {
  const stackOptions = useStackScreenOptions();
  const { user, isLoading } = useAuth();

  if (!isLoading && user && user.role !== 'external_driver') {
    return <Redirect href={homeRouteFor(user.role)} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, ...stackOptions }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="order/[id]" />
    </Stack>
  );
}
