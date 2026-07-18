// FIXED useMenuStore.ts
import axios from "axios";
import { toast } from "sonner";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useRestaurantStore } from "./useRestaurantStore";

const API_END_POINT = `${import.meta.env.VITE_API_BASE_URL}/menu`;
axios.defaults.withCredentials = true;

const getErrorMessage = (error: any): string => {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
};

type MenuItem = {
  _id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  restaurant: string;
};

type MenuState = {
  loading: boolean;
  menu: MenuItem | null;
  menus: MenuItem[]; // FIXED: Added for all menus list
  createMenu: (formData: FormData) => Promise<MenuItem | null>;
  editMenu: (menuId: string, formData: FormData) => Promise<MenuItem | null>;
  deleteMenu: (menuId: string) => Promise<boolean>;
  getMenu: (menuId: string) => Promise<MenuItem | null>; // FIXED: Added
  getAllMenus: () => Promise<void>; // FIXED: Added for search
};

export const useMenuStore = create<MenuState>()(
  persist(
    (set) => ({
      loading: false,
      menu: null,
      menus: [], // FIXED: Initialize empty array

      // FIXED: Create menu with better error handling and state sync
      createMenu: async (formData: FormData) => {
        try {
          set({ loading: true });
          const response = await axios.post(`${API_END_POINT}/`, formData, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          });

          if (response.data.success) {
            toast.success(response.data.message);
            const newMenu = response.data.menu;
            set({ menu: newMenu });

            // FIXED: Sync with restaurant store, but also re-fetch to ensure consistency
            useRestaurantStore.getState().addMenuToRestaurant(newMenu);

            // FIXED: Re-fetch restaurant to get fully populated data
            await useRestaurantStore.getState().getRestaurant();

            return newMenu;
          }
          return null;
        } catch (error: any) {
          toast.error(getErrorMessage(error));
          return null;
        } finally {
          set({ loading: false });
        }
      },

      // FIXED: Edit menu with better state sync
      editMenu: async (menuId: string, formData: FormData) => {
        try {
          set({ loading: true });
          const response = await axios.put(
            `${API_END_POINT}/${menuId}`,
            formData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            },
          );

          if (response.data.success) {
            toast.success(response.data.message);
            const updatedMenu = response.data.menu;
            set({ menu: updatedMenu });

            // FIXED: Sync with restaurant store
            useRestaurantStore.getState().updateMenuToRestaurant(updatedMenu);

            // FIXED: Re-fetch to ensure consistency
            await useRestaurantStore.getState().getRestaurant();

            return updatedMenu;
          }
          return null;
        } catch (error: any) {
          toast.error(getErrorMessage(error));
          return null;
        } finally {
          set({ loading: false });
        }
      },

      // FIXED: Delete menu with proper cleanup
      deleteMenu: async (menuId: string) => {
        try {
          set({ loading: true });
          const response = await axios.delete(`${API_END_POINT}/${menuId}`);

          if (response.data.success) {
            toast.success(response.data.message);

            // FIXED: Remove from all relevant states
            useRestaurantStore.getState().removeMenuFromRestaurant(menuId);

            // FIXED: Also remove from menus list if present
            set((state) => ({
              menus: state.menus.filter((m) => m._id !== menuId),
            }));

            // FIXED: Re-fetch restaurant to sync
            await useRestaurantStore.getState().getRestaurant();

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

      // FIXED: Get single menu
      getMenu: async (menuId: string) => {
        try {
          set({ loading: true });
          const response = await axios.get(`${API_END_POINT}/${menuId}`);
          if (response.data.success) {
            set({ menu: response.data.menu });
            return response.data.menu;
          }
          return null;
        } catch (error: any) {
          toast.error(getErrorMessage(error));
          return null;
        } finally {
          set({ loading: false });
        }
      },

      // FIXED: Get all menus (useful for search)
      getAllMenus: async () => {
        try {
          set({ loading: true });
          const response = await axios.get(`${API_END_POINT}/`);
          if (response.data.success) {
            set({ menus: response.data.menus || [] });
          }
        } catch (error: any) {
          toast.error(getErrorMessage(error));
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: "menu-store",
      storage: createJSONStorage(() => localStorage),
      // FIXED: Don't persist menu data to avoid stale data
      partialize: (state) => ({
        // Only persist nothing - always fetch fresh
      }),
    },
  ),
);
