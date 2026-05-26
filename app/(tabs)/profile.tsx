import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Header } from '@/components/header';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={user?.role === 'boss' ? 'BOSS' : 'FAHRER'} code="CH" />
      <View style={styles.content}>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.name || 'User'}</Text>
          <Text style={styles.profileRole}>
            {user?.role === 'boss' ? 'Boss Account' : 'Driver Account'}
          </Text>
          <Text style={styles.profileUsername}>@{user?.username}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  profileInfo: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    color: Colors.ui.darkBlack,
  },
  profileRole: {
    fontSize: 16,
    color: Colors.ui.mediumGray,
    marginBottom: 4,
  },
  profileUsername: {
    fontSize: 14,
    color: Colors.ui.darkGray,
  },
  logoutButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

