export type CheckoutSessionRequest = {
  cartItems: {
    menuId: string;
    name: string;
    image: string;
    price: number; // FIXED: was string, backend expects number
    quantity: number; // FIXED: was string, backend expects number
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
  createdAt: string;
  updatedAt: string;
}

export type OrderState = {
  loading: boolean;
  orders: Orders[];
  createCheckoutSession: (
    checkoutSessionRequest: CheckoutSessionRequest,
  ) => Promise<void>;
  getOrderDetails: () => Promise<void>;
  getOrderBySessionId: (sessionId: string) => Promise<Orders | null>;
};
