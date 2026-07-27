import { Header } from "@/components/header";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { useTranslation } from "@/hooks/use-translation";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Order, orderService } from "../services/orderService";

export default function DriverDashboardScreen() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { t, language } = useTranslation();
  const router = useRouter();
  const timeLocale = language === "de" ? "de-DE" : "en-US";
  const [assignedOrders, setAssignedOrders] = useState<Order[]>([]);

  const loadDriverOrders = useCallback(() => {
    if (user?.id) {
      const orders = orderService.getOrdersByDriver(user.id);
      setAssignedOrders(orders);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (user?.id) {
      loadDriverOrders();
    }
  }, [isLoading, isAuthenticated, user?.id, router, loadDriverOrders]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "assigned":
        return Colors.ui.orange;
      case "in_progress":
        return Colors.ui.blue;
      case "completed":
        return Colors.ui.green;
      default:
        return Colors.ui.darkGray;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      assigned: t("driverDashboard", "statusAssigned"),
      in_progress: t("driverDashboard", "statusInProgress"),
      completed: t("driverDashboard", "statusCompleted"),
      cancelled: t("driverDashboard", "statusCancelled"),
    };
    return statusMap[status] || status;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.ui.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Header
        title="TRANSLOG PRO"
        subtitle={`${t("driverDashboard", "headerSubtitle")} - ${user?.name || t("common", "unknown")}`}
        code={user?.username?.[0]?.toUpperCase() || "U"}
        onCodePress={() => router.push("/driver/profile")}
        showLogout={true}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("driverDashboard", "myOrders")} ({assignedOrders.length})
          </Text>

          {assignedOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {t("driverDashboard", "emptyOrders")}
              </Text>
              <Text style={styles.emptyStateSubtext}>
                {t("driverDashboard", "emptyOrdersSub")}
              </Text>
            </View>
          ) : (
            <FlatList
              scrollEnabled={false}
              data={assignedOrders}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.orderCard}>
                  <View style={styles.orderHeader}>
                    <Text style={styles.orderNumber}>{item.orderNumber}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(item.status) },
                      ]}
                    >
                      <Text style={styles.statusBadgeText}>
                        {getStatusText(item.status)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.customerName}>{item.customer.name}</Text>
                  <Text style={styles.packageDesc}>
                    {item.package.description}
                  </Text>
                  <View style={styles.locationContainer}>
                    <View style={styles.locationItem}>
                      <Text style={styles.locationLabel}>
                        {t("driverDashboard", "pickup")}:
                      </Text>
                      <Text style={styles.locationText}>
                        {item.pickupLocation.city}
                      </Text>
                    </View>
                    <View style={styles.locationItem}>
                      <Text style={styles.locationLabel}>
                        {t("driverDashboard", "delivery")}:
                      </Text>
                      <Text style={styles.locationText}>
                        {item.deliveryLocation.city}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.timeContainer}>
                    <Text style={styles.timeText}>
                      ⏱{" "}
                      {new Date(item.scheduledPickupTime).toLocaleTimeString(
                        timeLocale,
                        { hour: "2-digit", minute: "2-digit" },
                      )}{" "}
                      -{" "}
                      {new Date(item.scheduledDeliveryTime).toLocaleTimeString(
                        timeLocale,
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </Text>
                  </View>
                  <View style={styles.priorityContainer}>
                    {item.priority === "urgent" && (
                      <Text style={styles.priorityUrgent}>
                        {t("driverDashboard", "priorityUrgent")}
                      </Text>
                    )}
                    {item.priority === "high" && (
                      <Text style={styles.priorityHigh}>
                        {t("driverDashboard", "priorityHigh")}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.lightGray,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.ui.lightGray,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  emptyState: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: Colors.ui.lightGray,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.ui.darkGray,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.ui.darkGray,
    textAlign: "center",
  },
  orderCard: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.ui.primary,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "700",
  },
  customerName: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  packageDesc: {
    fontSize: 12,
    color: Colors.ui.darkGray,
    marginBottom: 8,
  },
  locationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  locationItem: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 10,
    color: Colors.ui.darkGray,
    fontWeight: "600",
  },
  locationText: {
    fontSize: 12,
    color: Colors.light.text,
    fontWeight: "500",
  },
  timeContainer: {
    paddingVertical: 6,
    marginBottom: 8,
  },
  timeText: {
    fontSize: 11,
    color: Colors.light.text,
    fontWeight: "600",
  },
  priorityContainer: {
    flexDirection: "row",
    gap: 8,
  },
  priorityUrgent: {
    fontSize: 11,
    fontWeight: "700",
    color: "#d32f2f",
  },
  priorityHigh: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.ui.orange,
  },
});
