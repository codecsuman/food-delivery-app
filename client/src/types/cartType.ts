import { MenuItem } from "./restaurantType";

export interface CartItem extends MenuItem {
  quantity: number;
}

export type CartState = {
  cart: CartItem[];
  loading: boolean;
  addToCart: (item: MenuItem) => void;
  clearCart: () => void;
  removeFromTheCart: (id: string) => void;
  incrementQuantity: (id: string) => void;
  decrementQuantity: (id: string) => void;
};
