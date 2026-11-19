import { homeRouteFor, useAuth } from '@/app/context/AuthContext';
import { ChefTabBar } from '@/components/ChefTabBar';
import { useStackScreenOptions } from '@/lib/motion/useStackScreenOptions';
import { Redirect, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function ChefLayout() {
  const stackOptions = useStackScreenOptions();
  const { user, isLoading } = useAuth();

  if (!isLoading && !user) {
    return <Redirect href="/login" />;
  }

  // Im Web ist /chef direkt aufrufbar. Die Daten schützt RLS ohnehin, aber
  // ein Fahrer soll gar nicht erst in der Chef-Oberfläche landen.
  if (!isLoading && user && user.role !== 'boss') {
    return <Redirect href={homeRouteFor(user.role)} />;
  }

  return (
    <View style={styles.container}>
      <Stack screenOptions={{ headerShown: false, ...stackOptions }}>
        {/* Dashboard, Tankliste und Profil — app/chef/(tabs)/ */}
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="drivers" />
        <Stack.Screen name="vehicles" />
        <Stack.Screen name="trailers" />
        <Stack.Screen name="external-order" />
        <Stack.Screen name="account" />
        <Stack.Screen name="bosses" />
        <Stack.Screen name="reminders" />
        <Stack.Screen name="invoices" />
        <Stack.Screen name="drafts" />
      </Stack>
      {/* Unter dem Stack, damit die Leiste auf jeder Unterseite sichtbar bleibt. */}
      {user?.role === 'boss' && <ChefTabBar />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
