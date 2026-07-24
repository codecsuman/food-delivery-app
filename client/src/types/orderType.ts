export type CheckoutSessionRequest = {
  cartItems: {
    menuId: string;
    name: string;
    image: string;
    price: number;
    quantity: number;
  }[];
  deliveryDetails: {
    name: string;
    email: string;
    address: string;
    city: string;
  };
  restaurantId: string;
};

export interface Orders {
  _id: string;
  user: string;
  restaurant: string;
  deliveryDetails: {
    email: string;
    name: string;
    address: string;
    city: string;
  };
  cartItems: {
    menuId: string;
    name: string;
    image: string;
    price: number;
    quantity: number;
  }[];
  totalAmount: number;
  status: string;
  paymentIntentId?: string;
  paymentMethod?: "stripe" | "cod";
  createdAt: string;
  updatedAt: string;
}

export type OrderState = {
  loading: boolean;
  orders: Orders[];
  createCheckoutSession: (
    checkoutSessionRequest: CheckoutSessionRequest,
    paymentMethod?: "stripe" | "cod",
  ) => Promise<void>;
  getOrderDetails: () => Promise<void>;
  getOrderBySessionId: (sessionId: string) => Promise<Orders | null>;
  getOrderById: (orderId: string) => Promise<Orders | null>;
  pollOrderStatus: (
    orderId: string,
    interval?: number,
  ) => Promise<Orders | null>;
  cancelOrder: (orderId: string) => Promise<boolean>; // <-- FIXED: was Promise<void>
};
