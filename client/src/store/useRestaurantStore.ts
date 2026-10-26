import { Orders } from "@/types/orderType";
import {
  MenuItem,
  RestaurantOrderEvent,
  RestaurantState,
} from "@/types/restaurantType";
import { isValidObjectId } from "@/lib/validation";
import { findUnpersistedFields } from "@/lib/persistence";
import axios from "axios";
import { toast } from "sonner";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { API_BASE_URL } from "@/lib/api";

const API_END_POINT = `${API_BASE_URL}/restaurant`;
axios.defaults.withCredentials = true;

// Guards against out-of-order responses when the user opens restaurant A and
// quickly navigates to restaurant B. Only the newest request may update state.
let singleRestaurantRequestId = 0;
const inFlightRestaurantRequests = new Map<string, Promise<void>>();

const getErrorMessage = (error: any): string => {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
};

/**
 * Text fields that the API echoes back on create/update. Coordinates live in
 * `location.coordinates`, cuisines are JSON, and the banner is a file, so those
 * are verified by the server tests instead of this literal comparison.
 */
const RESTAURANT_PERSISTED_FIELDS = [
  "restaurantName",
  "address",
  "city",
  "state",
  "country",
  "pincode",
  "contact",
  "alternateContact",
  "deliveryTime",
  "deliveryPrice",
] as const;

const restaurantSnapshot = (formData: FormData): Record<string, unknown> => {
  const snapshot: Record<string, unknown> = {};
  for (const key of RESTAURANT_PERSISTED_FIELDS) {
    const value = formData.get(key);
    if (value !== null) snapshot[key] = value;
  }
  return snapshot;
};

const warnAboutUnpersistedRestaurantFields = (
  formData: FormData,
  saved: unknown,
) => {
  const missing = findUnpersistedFields(
    restaurantSnapshot(formData),
    (saved ?? {}) as Record<string, unknown>,
  );
  if (missing.length > 0) {
    toast.error(
      `The server did not save: ${missing.join(", ")}. The deployed backend is probably out of date — redeploy it and try again.`,
    );
    return true;
  }
  return false;
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
      singleRestaurantError: null,
      restaurantOrder: [],
      filterOptions: { cuisines: [], dishes: [] },

      setRestaurant: (restaurant) => {
        set({ restaurant });
      },

      createRestaurant: async (formData: FormData) => {
        try {
          set({ loading: true });
          const response = await axios.post(API_END_POINT, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          if (response.data.success) {
            set({ restaurant: response.data.restaurant });
            const notPersisted = warnAboutUnpersistedRestaurantFields(
              formData,
              response.data.restaurant,
            );
            if (!notPersisted) toast.success(response.data.message);
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
          const response = await axios.get(API_END_POINT, {
            params: { t: Date.now() },
          });
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
          // If we have a restaurant with ID, use /:id endpoint, otherwise use /
          const restaurantId = get().restaurant?._id;
          const url = restaurantId
            ? `${API_END_POINT}/${restaurantId}`
            : API_END_POINT;
          const response = await axios.put(url, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          if (response.data.success) {
            set({ restaurant: response.data.restaurant });
            const notPersisted = warnAboutUnpersistedRestaurantFields(
              formData,
              response.data.restaurant,
            );
            if (!notPersisted) toast.success(response.data.message);
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
          if (searchQuery) params.set("searchQuery", searchQuery);
          if (selectedCuisines.length)
            params.set("selectedCuisines", selectedCuisines.join(","));
          if (city) params.set("city", city);
          if (priceRange) {
            params.set("minPrice", String(priceRange[0]));
            params.set("maxPrice", String(priceRange[1]));
          }

          let response;
          if (searchText && searchText !== "all") {
            // Use /search/:searchText endpoint
            response = await axios.get(
              `${API_END_POINT}/search/${encodeURIComponent(searchText)}?${params.toString()}`,
            );
          } else {
            // Use /search endpoint (query-only)
            response = await axios.get(
              `${API_END_POINT}/search?${params.toString()}`,
            );
          }

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
            set({ searchedRestaurant: { data: [], count: 0 } });
          } else {
            toast.error(getErrorMessage(error));
            set({ searchedRestaurant: { data: [], count: 0 } });
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
        } catch (_error) {
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
        // A malformed id can never resolve to a restaurant. Reject it locally
        // instead of sending a request that is guaranteed to return 400.
        if (!isValidObjectId(restaurantId)) {
          const message =
            "This restaurant link is invalid. Please choose a restaurant from the list.";
          set({
            loading: false,
            singleRestaurant: null,
            singleRestaurantError: message,
          });
          toast.error("The requested restaurant ID is invalid.", {
            id: `restaurant-error-${restaurantId || "missing"}`,
          });
          return;
        }

        // React 18 StrictMode runs effects twice in development. Reuse the
        // in-flight promise so one navigation triggers one network request.
        const existingRequest = inFlightRestaurantRequests.get(restaurantId);
        if (existingRequest) return existingRequest;

        const requestId = ++singleRestaurantRequestId;

        const request = (async () => {
          try {
            set({
              loading: true,
              // Never show a previously viewed restaurant while loading.
              singleRestaurant: null,
              singleRestaurantError: null,
            });
            const response = await axios.get(
              `${API_END_POINT}/${restaurantId}?t=${Date.now()}`,
            );

            if (requestId !== singleRestaurantRequestId) return;

            if (response.data.success && response.data.restaurant) {
              set({ singleRestaurant: response.data.restaurant });
            } else {
              const message = "Restaurant not found.";
              set({ singleRestaurant: null, singleRestaurantError: message });
              toast.error(message, { id: `restaurant-error-${restaurantId}` });
            }
          } catch (error: any) {
            // Ignore responses for a restaurant the user already navigated away from.
            if (requestId !== singleRestaurantRequestId) return;

            const status = error?.response?.status;
            const message =
              status === 400
                ? "The requested restaurant ID is invalid."
                : status === 404
                  ? "Restaurant not found."
                  : getErrorMessage(error);

            set({ singleRestaurant: null, singleRestaurantError: message });
            toast.error(message, { id: `restaurant-error-${restaurantId}` });
          } finally {
            if (requestId === singleRestaurantRequestId) {
              set({ loading: false });
            }
          }
        })().finally(() => {
          inFlightRestaurantRequests.delete(restaurantId);
        });

        inFlightRestaurantRequests.set(restaurantId, request);
        return request;
      },

      getRestaurantOrders: async (options?: { silent?: boolean }) => {
        try {
          set({ loading: true });
          const response = await axios.get(
            `${API_END_POINT}/order?t=${Date.now()}`,
          );
          if (response.data.success) {
            set({ restaurantOrder: response.data.orders || [] });
          }
        } catch (error: any) {
          if (error?.response?.status === 404) {
            set({ restaurantOrder: [] });
          } else if (!options?.silent) {
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

      applyRestaurantOrderEvent: (event: RestaurantOrderEvent) => {
        set((state) => ({
          restaurantOrder: state.restaurantOrder.map((order) =>
            order._id === event.orderId
              ? {
                  ...order,
                  status: event.status,
                  ...(event.totalAmount !== undefined
                    ? { totalAmount: event.totalAmount }
                    : {}),
                  ...(event.cancellationReason !== undefined
                    ? { cancellationReason: event.cancellationReason ?? undefined }
                    : {}),
                  ...(event.cancelledAt
                    ? { cancelledAt: new Date(event.cancelledAt).toISOString() }
                    : {}),
                  ...(event.cancelledBy
                    ? {
                        cancelledBy:
                          event.cancelledBy as Orders["cancelledBy"],
                      }
                    : {}),
                  ...(event.refundStatus
                    ? {
                        refundStatus:
                          event.refundStatus as Orders["refundStatus"],
                      }
                    : {}),
                  updatedAt: new Date().toISOString(),
                }
              : order,
          ),
        }));
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
                count: response.data.count,
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
      partialize: (state) => ({
        appliedFilter: state.appliedFilter,
        restaurant: state.restaurant,
        // Kept for checkout totals after a refresh. The detail page verifies
        // that a persisted restaurant matches the id in the URL before using it.
        singleRestaurant: state.singleRestaurant,
      }),
    },
  ),
);
