import { Orders } from "./orderType";

export type MenuItem = {
  _id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  restaurant?: string | { _id: string; restaurantName: string; imageUrl?: string };
  imagePublicId?: string;
  popular?: boolean;
  orderCount?: number;
};

export type Restaurant = {
  _id: string;
  user: string;
  restaurantName: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  contact: number | null;
  alternateContact: number | null;
  deliveryTime: number;
  deliveryPrice: number;
  estimatedDeliveryTime?: number;
  cuisines: string[];
  menus: MenuItem[];
  imageUrl: string;
  imagePublicId?: string;
  location?: { type: "Point"; coordinates: [number, number] };
  rating?: number;
  ratingCount?: number;
};

export type SearchedRestaurant = {
  data: Restaurant[];
  count?: number;
};

export type FilterOptionsData = {
  cuisines: string[];
  dishes: string[];
};

export type RestaurantOrderEvent = {
  orderId: string;
  status: string;
  totalAmount?: number;
  cancellationReason?: string | null;
  cancelledAt?: string | Date | null;
  cancelledBy?: string | null;
  refundStatus?: string | null;
  paymentStatus?: string | null;
};

export type RestaurantState = {
  loading: boolean;
  restaurant: Restaurant | null;
  restaurants: Restaurant[];
  searchedRestaurant: SearchedRestaurant | null;
  appliedFilter: string[];
  singleRestaurant: Restaurant | null;
  /** Set when a restaurant detail request fails, so the UI can stop showing a skeleton. */
  singleRestaurantError: string | null;
  restaurantOrder: Orders[];
  /** Human-readable reason the owner order fetch failed (null when OK). */
  restaurantOrderError: string | null;
  filterOptions: FilterOptionsData;
  createRestaurant: (formData: FormData) => Promise<void>;
  getRestaurant: () => Promise<void>;
  updateRestaurant: (formData: FormData) => Promise<void>;
  searchRestaurant: (
    searchText: string,
    searchQuery: string,
    selectedCuisines: string[],
    priceRange?: [number, number],
    city?: string,
  ) => Promise<void>;
  getFilterOptions: () => Promise<void>;
  addMenuToRestaurant: (menu: MenuItem) => void;
  updateMenuToRestaurant: (menu: MenuItem) => void;
  removeMenuFromRestaurant: (menuId: string) => void;
  setAppliedFilter: (value: string) => void;
  resetAppliedFilter: () => void;
  getSingleRestaurant: (restaurantId: string) => Promise<void>;
  getRestaurantOrders: (options?: { silent?: boolean }) => Promise<void>;
  updateRestaurantOrder: (orderId: string, status: string) => Promise<void>;
  /** Merge a live `order:status` Socket.IO event into the dashboard list. */
  applyRestaurantOrderEvent: (event: RestaurantOrderEvent) => void;
  getUserRestaurants: () => Promise<void>;
  getAllRestaurants: () => Promise<void>;
  deleteRestaurant: (id: string) => Promise<boolean>;
  setRestaurant: (restaurant: Restaurant | null) => void; // ✅ added
};
