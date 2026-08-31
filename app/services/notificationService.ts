export interface Notification {
  id: string;
  userId: string;
  type:
    | "order_assigned"
    | "order_status_changed"
    | "order_delivered"
    | "order_cancelled";
  title: string;
  message: string;
  orderId: string;
  status: "unread" | "read";
  priority: "low" | "normal" | "high" | "urgent";
  createdAt: string;
  readAt: string | null;
  actionUrl: string;
  data?: Record<string, any>;
}

export interface OrderStatusUpdate {
  orderId: string;
  status:
    | "pending"
    | "assigned"
    | "in_progress"
    | "picked_up"
    | "delivered"
    | "cancelled";
  driverId: string;
  timestamp: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  notes?: string;
}

class SimpleEventEmitter {
  private listeners: Map<string, Function[]> = new Map();

  on(event: string, handler: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(...args));
    }
  }
}

class NotificationService extends SimpleEventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private notifications: Map<string, Notification> = new Map();
  private userId: string | null = null;

  /**
   * Verbindung zu WebSocket initialisieren
   */
  connect(
    userId: string,
    wsUrl: string = "ws://localhost:8080",
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.userId = userId;

      try {
        this.ws = new WebSocket(`${wsUrl}/notifications/${userId}`);

        this.ws.onopen = () => {
          console.log("✅ WebSocket verbunden");
          this.reconnectAttempts = 0;
          this.emit("connected");
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error("❌ WebSocket Fehler:", error);
          this.emit("error", error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log("⚠️ WebSocket getrennt");
          this.emit("disconnected");
          this.attemptReconnect(userId, wsUrl);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Nachricht vom Server verarbeiten
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case "notification":
          this.handleNotification(message.payload);
          break;
        case "order_status_update":
          this.handleOrderStatusUpdate(message.payload);
          break;
        case "ping":
          this.sendPong();
          break;
        default:
          console.log("Unbekannter Nachrichtentyp:", message.type);
      }
    } catch (error) {
      console.error("Fehler beim Verarbeiten der Nachricht:", error);
    }
  }

  /**
   * Benachrichtigung verarbeiten
   */
  private handleNotification(notification: Notification): void {
    this.notifications.set(notification.id, notification);
    this.emit("notification", notification);

    // Unterschiedliche Behandlung je nach Priorität
    if (
      notification.priority === "urgent" ||
      notification.priority === "high"
    ) {
      this.emit("notification:high-priority", notification);
    }

    console.log("🔔 Neue Benachrichtigung:", notification.title);
  }

  /**
   * Auftragsstatus aktualisieren
   */
  private handleOrderStatusUpdate(update: OrderStatusUpdate): void {
    this.emit("order:status_updated", update);
    console.log(`📍 Auftrag ${update.orderId} Status: ${update.status}`);
  }

  /**
   * Pong-Antwort senden (Heartbeat)
   */
  private sendPong(): void {
    this.send({ type: "pong" });
  }

  /**
   * Nachricht an Server senden
   */
  send(message: Record<string, any>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn("⚠️ WebSocket nicht verbunden");
    }
  }

  /**
   * Benachrichtigung als gelesen markieren
   */
  markAsRead(notificationId: string): void {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.status = "read";
      notification.readAt = new Date().toISOString();
      this.notifications.set(notificationId, notification);
      this.send({ type: "notification_read", notificationId });
      this.emit("notification:marked_as_read", notification);
    }
  }

  /**
   * Alle Benachrichtigungen abrufen
   */
  getNotifications(): Notification[] {
    return Array.from(this.notifications.values());
  }

  /**
   * Ungelesene Benachrichtigungen abrufen
   */
  getUnreadNotifications(): Notification[] {
    return this.getNotifications().filter((n) => n.status === "unread");
  }

  /**
   * Anzahl der ungelesenen Benachrichtigungen
   */
  getUnreadCount(): number {
    return this.getUnreadNotifications().length;
  }

  /**
   * Auftrag-Status aktualisieren (vom Fahrer)
   */
  updateOrderStatus(update: OrderStatusUpdate): void {
    this.send({
      type: "order_status_update",
      payload: update,
    });
  }

  /**
   * Benachrichtigung löschen
   */
  deleteNotification(notificationId: string): void {
    this.notifications.delete(notificationId);
    this.send({ type: "notification_delete", notificationId });
    this.emit("notification:deleted", notificationId);
  }

  /**
   * Alle Benachrichtigungen löschen
   */
  clearAll(): void {
    this.notifications.clear();
    this.send({ type: "notifications_clear_all" });
    this.emit("notifications:cleared");
  }

  /**
   * Automatisches Reconnect versuchen
   */
  private attemptReconnect(userId: string, wsUrl: string): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      console.log(`🔄 Reconnect versucht in ${delay}ms...`);

      setTimeout(() => {
        this.connect(userId, wsUrl).catch(() => {
          // Fehler wird in der nächsten Runde versucht
        });
      }, delay);
    }
  }

  /**
   * Verbindung trennen
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.emit("disconnected");
  }

  /**
   * Verbindungsstatus
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export default new NotificationService();
