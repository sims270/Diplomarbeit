import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  SafeAreaView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationContext';
import { NotificationItem } from './NotificationItem';

export const NotificationCenter: React.FC = () => {
  const { notifications, unreadCount, isConnected, clearAll } = useNotifications();
  const [modalVisible, setModalVisible] = useState(false);

  const handleNotificationPress = (orderId: string) => {
    // Navigation zur Auftragsdetails
    setModalVisible(false);
    // TODO: navigate(`/orders/${orderId}`);
  };

  const handleClearAll = () => {
    if (notifications.length > 0) {
      clearAll();
    }
  };

  return (
    <>
      {/* Benachrichtigungsglocke Badge */}
      <TouchableOpacity
        style={styles.badge}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons name="bell" size={24} color="#FFF" />
        {unreadCount > 0 && (
          <View style={styles.badgeCounter}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        )}
        {!isConnected && (
          <View style={styles.disconnectedIndicator}>
            <MaterialCommunityIcons name="wifi-off" size={12} color="#FFF" />
          </View>
        )}
      </TouchableOpacity>

      {/* Benachrichtigungsmodal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Benachrichtigungen</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <MaterialCommunityIcons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.statusBar}>
            <View style={styles.statusInfo}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isConnected ? '#34C759' : '#999' },
                ]}
              />
              <Text style={styles.statusText}>
                {isConnected ? 'Live verbunden' : 'Offline'}
              </Text>
              <Text style={styles.unreadBadge}>
                {unreadCount} {unreadCount === 1 ? 'ungelesen' : 'ungelesen'}
              </Text>
            </View>
          </View>

          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="inbox" size={48} color="#CCC" />
              <Text style={styles.emptyText}>Keine Benachrichtigungen</Text>
              <Text style={styles.emptySubtext}>
                Du wirst hier benachrichtigt, wenn neue Aufträge zugewiesen werden
              </Text>
            </View>
          ) : (
            <>
              <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <NotificationItem
                    notification={item}
                    onPress={() => handleNotificationPress(item.orderId)}
                  />
                )}
                contentContainerStyle={styles.listContent}
              />

              {notifications.length > 0 && (
                <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
                  <MaterialCommunityIcons name="delete-sweep" size={20} color="#FFF" />
                  <Text style={styles.clearButtonText}>Alle löschen</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative',
  },
  badgeCounter: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  disconnectedIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    padding: 4,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  modal: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  statusBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FF',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  unreadBadge: {
    marginLeft: 'auto',
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  clearButton: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#FF3B30',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  clearButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },
});
