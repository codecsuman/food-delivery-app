// FIXED useUserStore.ts
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import axios from "axios";
import { LoginInputState, SignupInputState } from "@/schema/userSchema";
import { toast } from "sonner";

const API_END_POINT = `${import.meta.env.VITE_API_BASE_URL}/user`;
axios.defaults.withCredentials = true;

type User = {
  _id: string;
  fullname: string;
  email: string;
  contact: number | null;
  address: string;
  city: string;
  country: string;
  profilePicture: string;
  admin: boolean;
  isVerified: boolean;
  lastLogin?: string;
  createdAt?: string;
};

type ProfileUpdateInput = {
  fullname?: string;
  email?: string;
  contact?: string | number;
  address?: string;
  city?: string;
  country?: string;
  profilePicture?: string;
};

type UserState = {
  user: User | null;
  isAuthenticated: boolean;
  isCheckingAuth: boolean;
  loading: boolean;
  signup: (input: SignupInputState) => Promise<void>;
  login: (input: LoginInputState) => Promise<void>;
  verifyEmail: (verificationCode: string) => Promise<void>;
  checkAuthentication: () => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  updateProfile: (input: ProfileUpdateInput) => Promise<void>;
  setUser: (user: User | null) => void;
  refreshUser: () => Promise<void>; // FIXED: Added
};

const getErrorMessage = (error: any): string => {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isCheckingAuth: true,
      loading: false,

      setUser: (user) => set({ user }),

      signup: async (input: SignupInputState) => {
        try {
          set({ loading: true });
          const response = await axios.post(`${API_END_POINT}/signup`, input, {
            headers: { "Content-Type": "application/json" },
          });
          if (response.data.success) {
            toast.success(response.data.message);
            set({ user: response.data.user, isAuthenticated: true });
          }
        } catch (error: any) {
          toast.error(getErrorMessage(error));
        } finally {
          set({ loading: false });
        }
      },

      login: async (input: LoginInputState) => {
        try {
          set({ loading: true });
          const response = await axios.post(`${API_END_POINT}/login`, input, {
            headers: { "Content-Type": "application/json" },
          });
          if (response.data.success) {
            toast.success(response.data.message);
            set({ user: response.data.user, isAuthenticated: true });
          }
        } catch (error: any) {
          toast.error(getErrorMessage(error));
        } finally {
          set({ loading: false });
        }
      },

      verifyEmail: async (verificationCode: string) => {
        try {
          set({ loading: true });
          const response = await axios.post(
            `${API_END_POINT}/verify-email`,
            { verificationCode },
            {
              headers: { "Content-Type": "application/json" },
            },
          );
          if (response.data.success) {
            toast.success(response.data.message);
            set({ user: response.data.user, isAuthenticated: true });
          }
        } catch (error: any) {
          toast.error(getErrorMessage(error));
        } finally {
          set({ loading: false });
        }
      },

      // FIXED: Better auth check with error handling
      checkAuthentication: async () => {
        try {
          set({ isCheckingAuth: true });
          const response = await axios.get(`${API_END_POINT}/check-auth`, {
            // FIXED: Add cache buster
            params: { t: Date.now() },
          });
          if (response.data.success) {
            set({
              user: response.data.user,
              isAuthenticated: true,
              isCheckingAuth: false,
            });
          } else {
            set({ user: null, isAuthenticated: false, isCheckingAuth: false });
          }
        } catch (error: any) {
          // FIXED: Clear state on any auth error
          set({ user: null, isAuthenticated: false, isCheckingAuth: false });
          // Only show toast for non-401 errors to avoid spam
          if (error?.response?.status !== 401) {
            console.error("Auth check error:", error);
          }
        }
      },

      logout: async () => {
        try {
          set({ loading: true });
          const response = await axios.post(`${API_END_POINT}/logout`);
          if (response.data.success) {
            toast.success(response.data.message);
            set({ user: null, isAuthenticated: false });
            // FIXED: Clear all stores on logout
            localStorage.removeItem("cart-store");
            localStorage.removeItem("restaurant-store");
            localStorage.removeItem("menu-store");
            localStorage.removeItem("order-store");
          }
        } catch (error: any) {
          toast.error(getErrorMessage(error));
        } finally {
          set({ loading: false });
        }
      },

      forgotPassword: async (email: string) => {
        try {
          set({ loading: true });
          const response = await axios.post(
            `${API_END_POINT}/forgot-password`,
            { email },
          );
          if (response.data.success) {
            toast.success(response.data.message);
          }
        } catch (error: any) {
          toast.error(getErrorMessage(error));
        } finally {
          set({ loading: false });
        }
      },

      resetPassword: async (token: string, newPassword: string) => {
        try {
          set({ loading: true });
          const response = await axios.post(
            `${API_END_POINT}/reset-password/${token}`,
            { newPassword },
          );
          if (response.data.success) {
            toast.success(response.data.message);
          }
        } catch (error: any) {
          toast.error(getErrorMessage(error));
        } finally {
          set({ loading: false });
        }
      },

      // FIXED: Update profile with immediate state update
      updateProfile: async (input: ProfileUpdateInput) => {
        try {
          set({ loading: true });
          const response = await axios.put(
            `${API_END_POINT}/profile/update`,
            input,
            {
              headers: { "Content-Type": "application/json" },
            },
          );
          if (response.data.success) {
            toast.success(response.data.message);
            // FIXED: Ensure we get back full user object
            set({ user: response.data.user });
          }
        } catch (error: any) {
          toast.error(getErrorMessage(error));
        } finally {
          set({ loading: false });
        }
      },

      // FIXED: Refresh user data from server
      refreshUser: async () => {
        try {
          const response = await axios.get(`${API_END_POINT}/profile`, {
            params: { t: Date.now() },
          });
          if (response.data.success) {
            set({ user: response.data.user });
          }
        } catch (error: any) {
          console.error("Refresh user error:", error);
        }
      },
    }),
    {
      name: "user-store",
      storage: createJSONStorage(() => localStorage),
      // FIXED: Only persist minimal auth state
      partialize: (state) => ({
        // Don't persist user data - always fetch fresh
        // Only keep auth flag for initial check
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
