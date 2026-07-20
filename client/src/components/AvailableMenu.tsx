import { MenuItem, Restaurant } from "@/types/restaurantType";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter } from "./ui/card";
import { useCartStore } from "@/store/useCartStore";
import { useRestaurantStore } from "@/store/useRestaurantStore";
import { useNavigate } from "react-router-dom";
import { Plus, Check, UtensilsCrossed, Loader2 } from "lucide-react";
import { useState } from "react";

const AvailableMenu = ({
  menus,
  restaurant,
  loading,
}: {
  menus: MenuItem[];
  restaurant?: Restaurant;
  loading?: boolean;
}) => {
  const { addToCart, cart, clearCart } = useCartStore();  // ADD clearCart HERE
  const { setRestaurant } = useRestaurantStore();
  const navigate = useNavigate();
  const [, setAddedItems] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [orderingId, setOrderingId] = useState<string | null>(null);

  const isInCart = (menuId: string) => cart.some((item) => item._id === menuId);

  // ADD THIS HELPER: Check if adding from a different restaurant
  const checkRestaurantMismatch = (): boolean => {
    if (cart.length === 0) return true; // Cart empty, no conflict
    if (!restaurant) return true; // No restaurant context
    if (!cart[0].restaurant) return true; // Cart items have no restaurant info
    if (cart[0].restaurant === restaurant._id) return true; // Same restaurant

    // Different restaurant - ask user
    const confirmSwitch = confirm(
      "Your cart has items from another restaurant. Starting a new order will clear your current cart. Continue?"
    );
    if (confirmSwitch) {
      clearCart();
      return true;
    }
    return false;
  };

  const handleAddToCart = async (menu: MenuItem) => {
    if (addingId === menu._id || isInCart(menu._id)) return;

    // ADD THIS: Check restaurant mismatch before adding
    if (!checkRestaurantMismatch()) return;

    setAddingId(menu._id);
    if (restaurant) setRestaurant(restaurant); // ✅ save restaurant before cart update
    addToCart(menu);
    setAddedItems((prev) => new Set(prev).add(menu._id));
    setTimeout(() => {
      setAddingId(null);
      navigate("/cart");
    }, 400);
  };

  const handleOrderDirectly = async (menu: MenuItem) => {
    if (orderingId === menu._id) return;

    // ADD THIS: Check restaurant mismatch before ordering
    if (!checkRestaurantMismatch()) return;

    setOrderingId(menu._id);
    if (restaurant) setRestaurant(restaurant); // ✅ save restaurant before cart update
    addToCart(menu);
    setTimeout(() => {
      setOrderingId(null);
      navigate("/cart");
    }, 300);
  };

  if (loading) {
    return (
      <div className="py-4">
        <div className="mb-6">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded mt-2 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 p-0">
              <div className="h-48 bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <CardContent className="p-4">
                <div className="h-6 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
                <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1" />
                <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-3" />
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <div className="h-11 w-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!menus || menus.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-24 px-6 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30">
        <div className="h-14 w-14 rounded-full bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center mb-4">
          <UtensilsCrossed className="h-7 w-7 text-orange-500" />
        </div>
        <p className="text-gray-600 dark:text-gray-300 font-medium">No menu items available</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">The restaurant hasn't added any dishes yet. Check back later!</p>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">Available Menus</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{menus.length} {menus.length === 1 ? "item" : "items"} available</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {menus.map((menu: MenuItem) => (
          <Card key={menu._id} className="group bg-white dark:bg-gray-800 shadow-sm rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-300 hover:-translate-y-1 p-0">
            <div className="relative overflow-hidden">
              <img
                src={menu.image}
                alt={menu.name}
                className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/400x300?text=No+Image"; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              {isInCart(menu._id) && (
                <div className="absolute top-3 right-3 bg-green-500 text-white px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-md">
                  <Check className="w-3 h-3" /> In Cart
                </div>
              )}
              {menu.popular && (
                <div className="absolute top-3 left-3 bg-orange-500 text-white px-2.5 py-1 rounded-full text-xs font-semibold shadow-md">
                  Popular
                </div>
              )}
            </div>

            <CardContent className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 truncate">{menu.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 min-h-[2.5rem]">{menu.description || "No description available"}</p>
              <p className="text-lg font-bold mt-3 bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent inline-block">₹{menu.price}</p>
              {menu.orderCount !== undefined && menu.orderCount > 0 && (
                <p className="text-xs text-gray-400 mt-1">{menu.orderCount} orders</p>
              )}
            </CardContent>

            <CardFooter className="p-4 pt-0 flex gap-2">
              <Button
                onClick={() => handleAddToCart(menu)}
                disabled={isInCart(menu._id) || addingId === menu._id || orderingId === menu._id}
                className={`flex-1 h-11 font-semibold rounded-lg transition-all duration-200 ${
                  isInCart(menu._id)
                    ? "bg-green-500 hover:bg-green-600 text-white cursor-default"
                    : addingId === menu._id
                    ? "bg-orange-400 text-white cursor-wait"
                    : "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md shadow-orange-500/20"
                }`}
              >
                {addingId === menu._id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : isInCart(menu._id) ? <Check className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                {addingId === menu._id ? "Adding..." : isInCart(menu._id) ? "Added" : "Add to Cart"}
              </Button>
              <Button
                onClick={() => handleOrderDirectly(menu)}
                disabled={orderingId === menu._id || addingId === menu._id}
                variant="outline"
                className="h-11 px-4 rounded-lg border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:border-orange-300 transition-all"
              >
                {orderingId === menu._id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Order"}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AvailableMenu;