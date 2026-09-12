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
    lat?: number; // FIX: added — backend now accepts/stores this
    lng?: number; // FIX: added — backend now accepts/stores this
  };
  restaurantId: string;
};

// FIX: added — matches what getOrderById/getOrderBySessionId actually populate
export interface PopulatedRestaurant {
  _id: string;
  restaurantName: string;
  imageUrl: string;
  user: string;
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
  deliveryTime: number;
  deliveryPrice: number;
}

// FIX: added — matches trackingHistory entries written by trackingSocket.ts
export interface TrackingHistoryEntry {
  location: [number, number]; // [lng, lat]
  status: string;
  timestamp: string;
}

export interface Orders {
  _id: string;
  user: string;
  restaurant: string | PopulatedRestaurant; // FIX: was string-only; backend populates this object on getOrderById/getOrderBySessionId
  deliveryDetails: {
    email: string;
    name: string;
    address: string;
    city: string;
    lat?: number; // FIX: added
    lng?: number; // FIX: added
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
  currentEta?: number; // FIX: added — written by trackingSocket.ts
  currentDistance?: number; // FIX: added — written by trackingSocket.ts
  trackingHistory?: TrackingHistoryEntry[]; // FIX: added — written by trackingSocket.ts
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
  cancelOrder: (orderId: string) => Promise<boolean>;
};
