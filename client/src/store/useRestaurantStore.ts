import { Orders } from "@/types/orderType";
import { MenuItem, RestaurantState } from "@/types/restaurantType";
import axios from "axios";
import { toast } from "sonner";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const API_END_POINT = `${import.meta.env.VITE_API_BASE_URL}/restaurant`;
axios.defaults.withCredentials = true;

const getErrorMessage = (error: any): string => {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
};

export const useRestaurantStore = create<RestaurantState>()(
  persist(
    (set, get) => ({
      loading: false,
      restaurant: null,
      restaurants: [],
      searchedRestaurant: null,
      appliedFilter: [],
      singleRestaurant: null,
      restaurantOrder: [],
      filterOptions: { cuisines: [], dishes: [] },

      createRestaurant: async (formData: FormData) => {
        try {
          set({ loading: true });
          const response = await axios.post(`${API_END_POINT}/`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          if (response.data.success) {
            toast.success(response.data.message);
            set({ restaurant: response.data.restaurant });
          }
        } catch (error: any) {
          toast.error(getErrorMessage(error));
        } finally {
          set({ loading: false });
        }
      },

      getRestaurant: async () => {
        try {
          set({ loading: true });
          const response = await axios.get(`${API_END_POINT}/?t=${Date.now()}`);
          if (response.data.success) {
            set({ restaurant: response.data.restaurant });
          }
        } catch (error: any) {
          if (error?.response?.status === 404) {
            set({ restaurant: null });
          } else {
            toast.error(getErrorMessage(error));
          }
        } finally {
          set({ loading: false });
        }
      },

      updateRestaurant: async (formData: FormData) => {
        try {
          set({ loading: true });
          const response = await axios.put(`${API_END_POINT}/`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          if (response.data.success) {
            toast.success(response.data.message);
            set({ restaurant: response.data.restaurant });
          }
        } catch (error: any) {
          toast.error(getErrorMessage(error));
        } finally {
          set({ loading: false });
        }
      },

      searchRestaurant: async (
        searchText: string,
        searchQuery: string,
        selectedCuisines: string[],
        priceRange?: [number, number],
        city?: string,
      ) => {
        try {
          set({ loading: true });
          const params = new URLSearchParams();
          if (searchText) params.set("searchText", searchText);
          if (searchQuery) params.set("searchQuery", searchQuery);
          if (selectedCuisines.length)
            params.set("selectedCuisines", selectedCuisines.join(","));
          if (city) params.set("city", city);
          if (priceRange) {
            params.set("minPrice", String(priceRange[0]));
            params.set("maxPrice", String(priceRange[1]));
          }

          const response = await axios.get(
            `${API_END_POINT}/search?${params.toString()}`,
          );
          if (response.data.success) {
            set({
              searchedRestaurant: {
                data: response.data.restaurants || [],
                count: response.data.count,
              },
            });
          }
        } catch (error: any) {
          if (error?.response?.status === 404) {
            set({ searchedRestaurant: { data: [] } });
          } else {
            toast.error(getErrorMessage(error));
          }
        } finally {
          set({ loading: false });
        }
      },

      getFilterOptions: async () => {
        try {
          const response = await axios.get(`${API_END_POINT}/filters`);
          if (response.data.success) {
            set({
              filterOptions: {
                cuisines: response.data.cuisines || [],
                dishes: response.data.dishes || [],
              },
            });
          }
        } catch (error: any) {
          // silent fail
        }
      },

      addMenuToRestaurant: (menu: MenuItem) => {
        set((state) => {
          if (!state.restaurant) return state;
          const exists = state.restaurant.menus.some(
            (m: any) => m._id === menu._id,
          );
          if (exists) return state;
          return {
            restaurant: {
              ...state.restaurant,
              menus: [...state.restaurant.menus, menu],
            },
          };
        });
      },

      updateMenuToRestaurant: (updatedMenu: MenuItem) => {
        set((state) => {
          const updates: any = {};
          if (state.restaurant) {
            const updatedMenuList = state.restaurant.menus.map((menu: any) =>
              menu._id === updatedMenu._id ? updatedMenu : menu,
            );
            updates.restaurant = {
              ...state.restaurant,
              menus: updatedMenuList,
            };
          }
          if (state.singleRestaurant?.menus) {
            const updatedSingleMenus = state.singleRestaurant.menus.map(
              (menu: any) =>
                menu._id === updatedMenu._id ? updatedMenu : menu,
            );
            updates.singleRestaurant = {
              ...state.singleRestaurant,
              menus: updatedSingleMenus,
            };
          }
          return updates;
        });
      },

      removeMenuFromRestaurant: (menuId: string) => {
        set((state) => {
          const updates: any = {};
          if (state.restaurant) {
            updates.restaurant = {
              ...state.restaurant,
              menus: state.restaurant.menus.filter(
                (menu: any) => menu._id !== menuId,
              ),
            };
          }
          if (state.singleRestaurant?.menus) {
            updates.singleRestaurant = {
              ...state.singleRestaurant,
              menus: state.singleRestaurant.menus.filter(
                (menu: any) => menu._id !== menuId,
              ),
            };
          }
          return updates;
        });
      },

      setAppliedFilter: (value: string) => {
        set((state) => {
          const isAlreadyApplied = state.appliedFilter.includes(value);
          const updatedFilter = isAlreadyApplied
            ? state.appliedFilter.filter((item) => item !== value)
            : [...state.appliedFilter, value];
          return { appliedFilter: updatedFilter };
        });
      },

      resetAppliedFilter: () => {
        set({ appliedFilter: [] });
      },

      getSingleRestaurant: async (restaurantId: string) => {
        try {
          set({ loading: true });
          const response = await axios.get(
            `${API_END_POINT}/${restaurantId}?t=${Date.now()}`,
          );
          if (response.data.success) {
            set({ singleRestaurant: response.data.restaurant });
          }
        } catch (error: any) {
          toast.error(getErrorMessage(error));
        } finally {
          set({ loading: false });
        }
      },

      getRestaurantOrders: async () => {
        try {
          set({ loading: true });
          const response = await axios.get(
            `${API_END_POINT}/order?t=${Date.now()}`,
          );
          if (response.data.success) {
            set({ restaurantOrder: response.data.orders });
          }
        } catch (error: any) {
          if (error?.response?.status === 404) {
            set({ restaurantOrder: [] });
          } else {
            toast.error(getErrorMessage(error));
          }
        } finally {
          set({ loading: false });
        }
      },

      updateRestaurantOrder: async (orderId: string, status: string) => {
        try {
          const response = await axios.put(
            `${API_END_POINT}/order/${orderId}/status`,
            { status },
            { headers: { "Content-Type": "application/json" } },
          );
          if (response.data.success) {
            const updatedOrders = get().restaurantOrder.map((order: Orders) =>
              order._id === orderId
                ? { ...order, status: response.data.status || status }
                : order,
            );
            set({ restaurantOrder: updatedOrders });
            toast.success(response.data.message || "Status updated");
          }
        } catch (error: any) {
          toast.error(getErrorMessage(error));
        }
      },

      getUserRestaurants: async () => {
        try {
          set({ loading: true });
          const response = await axios.get(
            `${API_END_POINT}/my-restaurants?t=${Date.now()}`,
          );
          if (response.data.success) {
            set({ restaurants: response.data.restaurants || [] });
          }
        } catch (error: any) {
          if (error?.response?.status !== 404) {
            toast.error(getErrorMessage(error));
          }
        } finally {
          set({ loading: false });
        }
      },

      getAllRestaurants: async () => {
        try {
          set({ loading: true });
          const response = await axios.get(
            `${API_END_POINT}/all?t=${Date.now()}`,
          );
          if (response.data.success) {
            set({
              searchedRestaurant: {
                data: response.data.restaurants || [],
              },
            });
          }
        } catch (error: any) {
          toast.error(getErrorMessage(error));
        } finally {
          set({ loading: false });
        }
      },

      deleteRestaurant: async (id: string) => {
        try {
          set({ loading: true });
          const response = await axios.delete(`${API_END_POINT}/${id}`);
          if (response.data.success) {
            toast.success(response.data.message);
            set((state) => ({
              restaurants: state.restaurants.filter((r) => r._id !== id),
              restaurant:
                state.restaurant?._id === id ? null : state.restaurant,
            }));
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
    }),
    {
      name: "restaurant-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ appliedFilter: state.appliedFilter }),
    },
  ),
);
