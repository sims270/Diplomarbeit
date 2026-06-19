import data from '../../data_examples.json';

export interface Order {
  id: string;
  orderNumber: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  pickupLocation: {
    address: string;
    city: string;
    zipCode: string;
  };
  deliveryLocation: {
    address: string;
    city: string;
    zipCode: string;
  };
  package: {
    description: string;
    weight: string;
    volume: string;
    fragile: boolean;
    value: number;
  };
  assignedTo: string | null;
  status: string;
  priority: 'normal' | 'high' | 'urgent';
  scheduledPickupTime: string;
  scheduledDeliveryTime: string;
  createdAt: string;
  createdBy: string;
}

interface Driver {
  id: string;
  name: string;
  role: string;
  status: string;
}

class OrderService {
  private orders: Order[] = (data.orders as any[]).map(o => ({
    ...o,
    status: String(o.status),
  }));
  private drivers: Driver[] = data.users.filter(u => u.role === 'fahrer');

  getAllOrders(): Order[] {
    return this.orders;
  }

  getOrdersByDriver(driverId: string): Order[] {
    return this.orders.filter(order => order.assignedTo === driverId);
  }

  getUnassignedOrders(): Order[] {
    return this.orders.filter(order => !order.assignedTo || order.status === 'pending');
  }

  assignOrderToDriver(orderId: string, driverId: string): boolean {
    const order = this.orders.find(o => o.id === orderId);
    const driver = this.drivers.find(d => d.id === driverId);

    if (order && driver) {
      order.assignedTo = driverId;
      order.status = 'assigned';
      return true;
    }
    return false;
  }

  updateOrderStatus(orderId: string, status: string): boolean {
    const order = this.orders.find(o => o.id === orderId);
    if (order) {
      order.status = status;
      return true;
    }
    return false;
  }

  getDrivers(): Driver[] {
    return this.drivers;
  }

  getOrderStats() {
    return {
      total: this.orders.length,
      pending: this.orders.filter(o => o.status === 'pending').length,
      assigned: this.orders.filter(o => o.status === 'assigned').length,
      inProgress: this.orders.filter(o => o.status === 'in_progress').length,
      completed: this.orders.filter(o => o.status === 'completed').length,
    };
  }
}

export const orderService = new OrderService();
