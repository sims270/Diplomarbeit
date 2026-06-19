import { StyleSheet, View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Header } from '@/components/header';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';

export default function DriverProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'profile' | 'settings'>('profile');

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <Header
        title="TRANSLOG PRO"
        subtitle={`FAHRER - ${user?.name || 'Unbekannt'}`}
        code={user?.username?.[0]?.toUpperCase() || 'U'}
      />

      <View style={styles.tabsContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'profile' && styles.tabActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>
            Profile
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'settings' && styles.tabActive]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>
            Settings
          </Text>
        </Pressable>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {activeTab === 'profile' ? (
          <>
            <View style={styles.profileCard}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatar}>
                  {user?.name?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
              <Text style={styles.profileName}>{user?.name || 'User'}</Text>
              <Text style={styles.profileRole}>
                🚗 Driver Account
              </Text>
              <Text style={styles.profileUsername}>@{user?.username}</Text>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>Trips</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>0 km</Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>0h</Text>
                <Text style={styles.statLabel}>Duration</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Username</Text>
              <Text style={styles.settingValue}>{user?.username}</Text>
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Role</Text>
              <Text style={styles.settingValue}>Driver</Text>
            </View>
          </View>
        )}
      </ScrollView>

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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.ui.primary || '#007AFF',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
  },
  tabTextActive: {
    color: Colors.ui.primary || '#007AFF',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 24,
  },
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.ui.primary || '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    color: '#1A1A1A',
  },
  profileRole: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  profileUsername: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.ui.primary || '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  settingsSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    color: '#1A1A1A',
  },
  settingItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 14,
    color: '#666',
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  logoutButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
