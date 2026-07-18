import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { useState } from "react";
import CheckoutConfirmPage from "./CheckoutConfirmPage";
import { useCartStore } from "@/store/useCartStore";
import { CartItem } from "@/types/cartType";
import { Link } from "react-router-dom";

const Cart = () => {
  const [open, setOpen] = useState<boolean>(false);
  const {
    cart,
    decrementQuantity,
    incrementQuantity,
    removeFromTheCart,
    clearCart,
  } = useCartStore();

  const totalAmount = cart.reduce((acc, ele) => {
    return acc + ele.price * ele.quantity;
  }, 0);

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear your cart?")) {
      clearCart();
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-orange-50/60 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 px-4">
        <div className="text-center">
          <div className="h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center mx-auto mb-5">
            <ShoppingCart className="h-8 w-8 text-orange-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Your Cart is Empty
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Looks like you haven't added anything to your cart yet.
          </p>
          <Link to="/">
            <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-8 h-11 rounded-lg shadow-md shadow-orange-500/20">
              Browse Restaurants
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/60 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Shopping Cart
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {cart.length} {cart.length === 1 ? "item" : "items"} in your cart
            </p>
          </div>
          <Button
            variant="link"
            onClick={handleClearAll}
            className="text-red-500 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Clear All
          </Button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <TableHead className="text-gray-500 dark:text-gray-400 font-semibold text-xs uppercase tracking-wide">
                  Image
                </TableHead>
                <TableHead className="text-gray-500 dark:text-gray-400 font-semibold text-xs uppercase tracking-wide">
                  Item
                </TableHead>
                <TableHead className="text-gray-500 dark:text-gray-400 font-semibold text-xs uppercase tracking-wide">
                  Price
                </TableHead>
                <TableHead className="text-gray-500 dark:text-gray-400 font-semibold text-xs uppercase tracking-wide">
                  Quantity
                </TableHead>
                <TableHead className="text-gray-500 dark:text-gray-400 font-semibold text-xs uppercase tracking-wide">
                  Total
                </TableHead>
                <TableHead className="text-right text-gray-500 dark:text-gray-400 font-semibold text-xs uppercase tracking-wide">
                  Remove
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cart.map((item: CartItem) => (
                <TableRow
                  key={item._id}
                  className="border-b border-gray-100 dark:border-gray-700 hover:bg-orange-50/40 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <TableCell>
                    <Avatar className="w-12 h-12 ring-1 ring-black/5 rounded-lg">
                      <AvatarImage src={item.image} alt={item.name} className="rounded-lg" />
                      <AvatarFallback className="bg-orange-100 text-orange-600 text-xs rounded-lg">
                        {item.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium text-gray-900 dark:text-white">
                    {item.name}
                  </TableCell>
                  <TableCell className="text-gray-500 dark:text-gray-400">
                    ₹{item.price}
                  </TableCell>
                  <TableCell>
                    <div className="w-fit flex items-center rounded-full border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                      <Button
                        onClick={() => decrementQuantity(item._id)}
                        size="icon"
                        variant="outline"
                        className="rounded-none border-none h-8 w-8 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-10 text-center font-bold text-gray-900 dark:text-white">
                        {item.quantity}
                      </span>
                      <Button
                        onClick={() => incrementQuantity(item._id)}
                        size="icon"
                        className="rounded-none h-8 w-8 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-none"
                        variant="outline"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold text-gray-900 dark:text-white">
                    ₹{item.price * item.quantity}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFromTheCart(item._id)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Total Section */}
          <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-700/30">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">Subtotal</span>
              <span className="text-base font-semibold text-gray-900 dark:text-white">
                ₹{totalAmount}
              </span>
            </div>
            <div className="flex justify-between items-center mb-6 pt-3 border-t border-gray-200 dark:border-gray-600">
              <span className="text-lg font-bold text-gray-900 dark:text-white">Total</span>
              <span className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                ₹{totalAmount}
              </span>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => setOpen(true)}
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-8 h-12 text-base font-semibold rounded-lg shadow-md shadow-orange-500/20"
              >
                Proceed To Checkout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <CheckoutConfirmPage open={open} setOpen={setOpen} />
    </div>
  );
};

export default Cart;