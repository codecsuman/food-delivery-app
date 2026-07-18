// FIXED useOrderStore.ts
import { CheckoutSessionRequest, OrderState } from "@/types/orderType";
import axios from "axios";
import { toast } from "sonner";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const API_END_POINT: string = `${import.meta.env.VITE_API_BASE_URL}/order`;
axios.defaults.withCredentials = true;

const getErrorMessage = (error: any): string => {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
};

export const useOrderStore = create<OrderState>()(
  persist(
    (set, _get) => ({
      loading: false,
      orders: [],

      createCheckoutSession: async (
        checkoutSession: CheckoutSessionRequest,
      ) => {
        try {
          set({ loading: true });
          const response = await axios.post(
            `${API_END_POINT}/checkout/create-checkout-session`,
            checkoutSession,
            {
              headers: {
                "Content-Type": "application/json",
              },
            },
          );

          if (response.data.success && response.data.session?.url) {
            // FIXED: Clear cart after successful checkout session creation
            // This is handled by the success page after redirect
            window.location.href = response.data.session.url;
          } else {
            toast.error("Failed to create checkout session");
          }
        } catch (error: any) {
          toast.error(getErrorMessage(error));
        } finally {
          set({ loading: false });
        }
      },

      // FIXED: Get order details with better error handling
      getOrderDetails: async () => {
        try {
          set({ loading: true });
          const response = await axios.get(`${API_END_POINT}/`);
          if (response.data.success) {
            set({ orders: response.data.orders || [] });
          } else {
            set({ orders: [] });
          }
        } catch (error: any) {
          // FIXED: Handle 404 as empty orders, not error
          if (error?.response?.status === 404) {
            set({ orders: [] });
          } else {
            toast.error(getErrorMessage(error));
          }
        } finally {
          set({ loading: false });
        }
      },

      // FIXED: Get order by session ID with better handling
      getOrderBySessionId: async (sessionId: string) => {
        try {
          set({ loading: true });
          const response = await axios.get(
            `${API_END_POINT}/session/${sessionId}`,
          );
          if (response.data.success) {
            // FIXED: Also add to orders list if not present
            const order = response.data.order;
            set((state) => {
              const exists = state.orders.some((o) => o._id === order._id);
              if (!exists) {
                return { orders: [order, ...state.orders] };
              }
              return state;
            });
            return order;
          }
          return null;
        } catch (error: any) {
          toast.error(getErrorMessage(error));
          return null;
        } finally {
          set({ loading: false });
        }
      },

      // FIXED: Poll for order status updates (real-time simulation)
      pollOrderStatus: async (orderId: string, _interval: number = 5000) => {
        const poll = async () => {
          try {
            const response = await axios.get(`${API_END_POINT}/${orderId}`);
            if (response.data.success) {
              const updatedOrder = response.data.order;
              set((state) => ({
                orders: state.orders.map((o) =>
                  o._id === orderId ? updatedOrder : o,
                ),
              }));
              return updatedOrder;
            }
          } catch (error) {
            console.error("Poll error:", error);
          }
          return null;
        };

        // Initial poll
        return await poll();
      },

      // FIXED: Cancel order
      cancelOrder: async (orderId: string) => {
        try {
          set({ loading: true });
          const response = await axios.put(
            `${API_END_POINT}/${orderId}/cancel`,
          );
          if (response.data.success) {
            toast.success(response.data.message);
            set((state) => ({
              orders: state.orders.map((o) =>
                o._id === orderId ? { ...o, status: "cancelled" } : o,
              ),
            }));
          }
        } catch (error: any) {
          toast.error(getErrorMessage(error));
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: "order-store",
      storage: createJSONStorage(() => localStorage),
      // FIXED: Don't persist orders - always fetch fresh
      partialize: (_state) => ({}),
    },
  ),
);
