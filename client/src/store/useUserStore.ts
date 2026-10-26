import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import axios from "axios";
import { LoginInputState, SignupInputState } from "@/schema/userSchema";
import { findUnpersistedFields } from "@/lib/persistence";
import { API_BASE_URL } from "@/lib/api";
import { toast } from "sonner";

const API_END_POINT = `${API_BASE_URL}/user`;
axios.defaults.withCredentials = true;

type User = {
  _id: string;
  fullname: string;
  email: string;
  contact: number | null;
  alternateContact: number | null;
  address: string;
  pincode: string;
  city: string;
  state: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
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
  alternateContact?: string | number;
  address?: string;
  pincode?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  profilePicture?: string;
};

type UserState = {
  user: User | null;
  isAuthenticated: boolean;
  isCheckingAuth: boolean;
  loading: boolean;
  signup: (input: SignupInputState) => Promise<boolean>;
  login: (input: LoginInputState) => Promise<boolean>;
  checkAuthentication: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (input: ProfileUpdateInput) => Promise<boolean>;
  setUser: (user: User | null) => void;
  refreshUser: () => Promise<void>;
};

const getErrorMessage = (error: any): string => {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
};

/**
 * Build the subset of profile fields that should come back unchanged from the
 * API. The avatar is excluded because Cloudinary replaces a data URI with a
 * hosted URL, so a literal comparison would always fail.
 */
const profileSnapshot = (input: ProfileUpdateInput): Record<string, unknown> => {
  const snapshot: Record<string, unknown> = {};
  for (const key of Object.keys(input) as (keyof ProfileUpdateInput)[]) {
    if (key === "profilePicture") continue;
    const value = input[key];
    snapshot[key] =
      key === "email" && typeof value === "string"
        ? value.trim().toLowerCase()
        : value;
  }
  return snapshot;
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isCheckingAuth: false,
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
            return true;
          }
          return false;
        } catch (error: any) {
          toast.error(getErrorMessage(error));
          return false;
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
            return true;
          }
          return false;
        } catch (error: any) {
          toast.error(getErrorMessage(error));
          return false;
        } finally {
          set({ loading: false });
        }
      },

      checkAuthentication: async () => {
        if (get().isCheckingAuth) return;
        try {
          set({ isCheckingAuth: true });
          const response = await axios.get(`${API_END_POINT}/check-auth`, {
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
          set({ user: null, isAuthenticated: false, isCheckingAuth: false });
          if (error?.response?.status !== 401) {
            // Auth check error - silent
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
            const updatedUser = response.data.user;
            set({ user: updatedUser });

            const missing = findUnpersistedFields(
              profileSnapshot(input),
              updatedUser,
            );
            if (missing.length > 0) {
              toast.error(
                `The server did not save: ${missing.join(", ")}. The deployed backend is probably out of date — redeploy it and try again.`,
              );
              return false;
            }

            toast.success(response.data.message);
            return true;
          }
          return false;
        } catch (error: any) {
          toast.error(getErrorMessage(error));
          return false;
        } finally {
          set({ loading: false });
        }
      },

      refreshUser: async () => {
        try {
          const response = await axios.get(`${API_END_POINT}/profile`, {
            params: { t: Date.now() },
          });
          if (response.data.success) {
            set({ user: response.data.user });
          }
        } catch {
          // Refresh user error - silent
        }
      },
    }),
    {
      name: "user-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ isAuthenticated: state.isAuthenticated }),
    },
  ),
);
