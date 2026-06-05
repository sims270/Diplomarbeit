import React, { useEffect } from 'react';
import { SafeAreaView, View, StyleSheet, ScrollView } from 'react-native';
import { NotificationProvider } from '../context/NotificationContext';
import { NotificationCenter } from '../components/NotificationCenter';
import { OrderStatusUpdate } from '../components/OrderStatusUpdate';
import { useNotificationsSorted } from '../hooks/useNotifications';
import { NotificationItem } from '../components/NotificationItem';

/**
 * Beispiel-Integrationen für das Real-Time Notification System
 */

/**
 * Fahrer Dashboard - mit Benachrichtigungen und Status-Updates
 */
export const DriverDashboard = ({ userId }: { userId: string }) => {
  return (
    <NotificationProvider userId={userId}>
      <SafeAreaView style={styles.container}>
        <ScrollView>
          {/* Benachrichtigungsglocke Badge */}
          <View style={styles.headerContent}>
            <NotificationCenter />
          </View>

          {/* Beispiel: Auftrag Status Update */}
          <View style={styles.content}>
            <OrderStatusUpdate
              orderId="AUFT-20260605-001"
              currentStatus="assigned"
              driverId={userId}
              location={{ latitude: 52.52, longitude: 13.405 }}
            />

            <OrderStatusUpdate
              orderId="AUFT-20260605-002"
              currentStatus="picked_up"
              driverId={userId}
              location={{ latitude: 52.5, longitude: 13.4 }}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </NotificationProvider>
  );
};

/**
 * Chef Dashboard - Aufträge zuweisen und Status überwachen
 */
export const ChefDashboard = ({ userId }: { userId: string }) => {
  const notifications = useNotificationsSorted(false); // Höchste Priorität zuerst

  return (
    <NotificationProvider userId={userId}>
      <SafeAreaView style={styles.container}>
        <ScrollView>
          {/* Benachrichtigungszentrum */}
          <View style={styles.headerContent}>
            <NotificationCenter />
          </View>

          {/* Neueste Benachrichtigungen */}
          <View style={styles.content}>
            {notifications.slice(0, 5).map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onPress={() => {
                  // Navigation zu Auftragsdetails
                  console.log('Navigate to order:', notification.orderId);
                }}
              />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </NotificationProvider>
  );
};

/**
 * Vollständig strukturierte App mit Notifications
 */
export const AppWithNotifications = () => {
  const userId = 'user_002'; // Würde normalerweise vom Auth-Context kommen

  return (
    <NotificationProvider userId={userId}>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* Dein Rest der App hier */}
          <NotificationCenter />
        </View>
      </SafeAreaView>
    </NotificationProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  headerContent: {
    padding: 16,
    alignItems: 'flex-end',
  },
  content: {
    flex: 1,
    padding: 12,
  },
});
