import { Orders } from "./orderType";

export type MenuItem = {
  _id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  restaurant?: string;
  imagePublicId?: string;
  popular?: boolean;
  orderCount?: number;
};

export type Restaurant = {
  _id: string;
  user: string;
  restaurantName: string;
  city: string;
  country: string;
  deliveryTime: number;
  deliveryPrice: number;
  estimatedDeliveryTime?: number;
  cuisines: string[];
  menus: MenuItem[];
  imageUrl: string;
  imagePublicId?: string;
  rating?: number;
  ratingCount?: number;
};

export type SearchedRestaurant = {
  data: Restaurant[];
  count?: number;
};

export type RestaurantState = {
  loading: boolean;
  restaurant: Restaurant | null;
  restaurants: Restaurant[];
  searchedRestaurant: SearchedRestaurant | null;
  appliedFilter: string[];
  singleRestaurant: Restaurant | null;
  restaurantOrder: Orders[];
  createRestaurant: (formData: FormData) => Promise<void>;
  getRestaurant: () => Promise<void>;
  updateRestaurant: (formData: FormData) => Promise<void>;
  searchRestaurant: (
    searchText: string,
    searchQuery: string,
    selectedCuisines: string[],
  ) => Promise<void>;
  addMenuToRestaurant: (menu: MenuItem) => void;
  updateMenuToRestaurant: (menu: MenuItem) => void;
  removeMenuFromRestaurant: (menuId: string) => void;
  setAppliedFilter: (value: string) => void;
  resetAppliedFilter: () => void;
  getSingleRestaurant: (restaurantId: string) => Promise<void>;
  getRestaurantOrders: () => Promise<void>;
  updateRestaurantOrder: (orderId: string, status: string) => Promise<void>;
  getUserRestaurants: () => Promise<void>;
  getAllRestaurants: () => Promise<void>;
  deleteRestaurant: (id: string) => Promise<boolean>;
};
