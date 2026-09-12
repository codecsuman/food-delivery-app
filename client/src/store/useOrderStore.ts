import { CheckoutSessionRequest, OrderState } from "@/types/orderType";
import { useCartStore } from "@/store/useCartStore";
import axios from "axios";
import { toast } from "sonner";
import { create } from "zustand";

const API_END_POINT: string = `${import.meta.env.VITE_API_BASE_URL}/order`;
axios.defaults.withCredentials = true;

const getErrorMessage = (error: any): string => {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
};

export const useOrderStore = create<OrderState>((set) => ({
  loading: false,
  orders: [],

  createCheckoutSession: async (
    checkoutSessionRequest: CheckoutSessionRequest,
    paymentMethod: "stripe" | "cod" = "stripe",
  ) => {
    try {
      set({ loading: true });
      const response = await axios.post(
        `${API_END_POINT}/checkout/create-checkout-session`,
        { ...checkoutSessionRequest, paymentMethod },
        { headers: { "Content-Type": "application/json" } },
      );

      if (response.data.success) {
        if (response.data.paymentMethod === "cod") {
          // COD order is already "confirmed" server-side — safe to clear immediately.
          toast.success(response.data.message);
          useCartStore.getState().clearCart();
          set((state) => ({
            orders: [response.data.order, ...state.orders],
          }));
          window.location.href = `/order/success?orderId=${response.data.order._id}`;
        } else if (response.data.session?.url) {
          // FIX: do NOT clear the cart here. The order is only "pending" at this
          // point — the user hasn't paid yet. If they cancel on Stripe's page or
          // the payment fails, the cart would already be empty with nothing to
          // recover. Clear the cart only after payment is actually confirmed
          // (e.g. on the /order/success page, once getOrderBySessionId or the
          // webhook confirms status === "confirmed").
          window.location.href = response.data.session.url;
        }
      } else {
        toast.error("Failed to create checkout session");
      }
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    } finally {
      set({ loading: false });
    }
  },

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
      if (error?.response?.status === 404) {
        set({ orders: [] });
      } else {
        toast.error(getErrorMessage(error));
      }
    } finally {
      set({ loading: false });
    }
  },

  getOrderBySessionId: async (sessionId: string) => {
    try {
      set({ loading: true });
      const response = await axios.get(`${API_END_POINT}/session/${sessionId}`);
      if (response.data.success) {
        const order = response.data.order;

        // FIX: this is the natural place to clear the cart for Stripe orders —
        // by the time this succeeds, the order is confirmed as paid.
        if (order.status === "confirmed") {
          useCartStore.getState().clearCart();
        }

        set((state) => {
          const exists = state.orders.some((o) => o._id === order._id);
          if (!exists) return { orders: [order, ...state.orders] };
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

  getOrderById: async (orderId: string) => {
    try {
      set({ loading: true });
      const response = await axios.get(`${API_END_POINT}/${orderId}`);
      if (response.data.success) {
        return response.data.order;
      }
      return null;
    } catch (error: any) {
      toast.error(getErrorMessage(error));
      return null;
    } finally {
      set({ loading: false });
    }
  },

  pollOrderStatus: async (orderId: string, _interval: number = 5000) => {
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
  },

  cancelOrder: async (orderId: string) => {
    try {
      set({ loading: true });
      const response = await axios.post(`${API_END_POINT}/${orderId}/cancel`);

      if (response.data.success) {
        toast.success(response.data.message || "Order cancelled successfully");
        set((state) => ({
          orders: state.orders.map((o) =>
            o._id === orderId ? { ...o, status: "cancelled" } : o,
          ),
        }));
        return true;
      } else {
        toast.error(response.data.message || "Failed to cancel order");
        return false;
      }
    } catch (error: any) {
      toast.error(getErrorMessage(error));
      return false;
    } finally {
      set({ loading: false });
    }
  },
}));
