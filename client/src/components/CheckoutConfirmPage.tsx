import { Dispatch, FormEvent, SetStateAction, useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useUserStore } from "@/store/useUserStore";
import { CheckoutSessionRequest } from "@/types/orderType";
import { useCartStore } from "@/store/useCartStore";
import { useRestaurantStore } from "@/store/useRestaurantStore";
import { useOrderStore } from "@/store/useOrderStore";
import { Loader2, MapPin, CreditCard, Banknote } from "lucide-react";

const CheckoutConfirmPage = ({
  open, setOpen,
}: {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}) => {
  const { user } = useUserStore();
  const { cart } = useCartStore();
  const { restaurant } = useRestaurantStore();
  const { createCheckoutSession, loading } = useOrderStore();
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "cod">("stripe");

  const [input, setInput] = useState({
    name: "", email: "", address: "", city: "", country: "",
  });

  useEffect(() => {
    if (user && open) {
      setInput({
        name: user.fullname || "",
        email: user.email || "",
        address: user.address || "",
        city: user.city || "",
        country: user.country || "",
      });
    }
  }, [user, open]);

  const changeEventHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInput((prev) => ({ ...prev, [name]: value }));
  };

  const checkoutHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.name || !input.address || !input.city || !input.country) return;
    if (!restaurant?._id) { console.error("No restaurant selected"); return; }
    if (cart.length === 0) { console.error("Cart is empty"); return; }

    try {
      const checkoutData: CheckoutSessionRequest = {
        cartItems: cart.map((cartItem) => ({
          menuId: cartItem._id, name: cartItem.name, image: cartItem.image,
          price: cartItem.price, quantity: cartItem.quantity,
        })),
        deliveryDetails: { name: input.name, email: input.email, address: input.address, city: input.city },
        restaurantId: restaurant._id,
      };
      await createCheckoutSession(checkoutData, paymentMethod);
    } catch (error) {
      console.error("Checkout error:", error);
    }
  };

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const deliveryPrice = restaurant?.deliveryPrice || 0;
  const total = subtotal + deliveryPrice;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-white dark:bg-gray-800 rounded-2xl border-none shadow-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-orange-500" />
            </div>
            Review Your Order
          </DialogTitle>
          <DialogDescription className="text-gray-500 dark:text-gray-400">
            Double-check your delivery details and ensure everything is in order.
          </DialogDescription>
        </DialogHeader>

        {/* Order Summary */}
        <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4 mb-2 border border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">Order Summary</h3>
          <div className="space-y-2">
            {cart.map((item) => (
              <div key={item._id} className="flex justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">{item.name} <span className="text-gray-400 dark:text-gray-500">× {item.quantity}</span></span>
                <span className="font-medium text-gray-900 dark:text-white">₹{item.price * item.quantity}</span>
              </div>
            ))}
            <div className="border-t border-gray-200 dark:border-gray-600 pt-2.5 mt-2.5 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                <span className="text-gray-700 dark:text-gray-300">₹{subtotal}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Delivery</span>
                <span className="text-gray-700 dark:text-gray-300">₹{deliveryPrice}</span>
              </div>
              <div className="flex justify-between font-bold text-lg mt-2 pt-2.5 border-t border-gray-200 dark:border-gray-600">
                <span className="text-gray-900 dark:text-white">Total</span>
                <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">₹{total}</span>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={checkoutHandler} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-gray-300 font-medium">Full Name</Label>
            <Input type="text" name="name" value={input.name} onChange={changeEventHandler} placeholder="Your full name" required className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500" />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-gray-300 font-medium">Email</Label>
            <Input disabled type="email" name="email" value={input.email} className="bg-gray-100 dark:bg-gray-700 text-gray-500 cursor-not-allowed rounded-lg" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 font-medium"><MapPin className="w-3.5 h-3.5 text-gray-400" /> Address</Label>
            <Input type="text" name="address" value={input.address} onChange={changeEventHandler} placeholder="Street address" required className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500" />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-gray-300 font-medium">City</Label>
            <Input type="text" name="city" value={input.city} onChange={changeEventHandler} placeholder="City" required className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500" />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-gray-300 font-medium">Country</Label>
            <Input type="text" name="country" value={input.country} onChange={changeEventHandler} placeholder="Country" required className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500" />
          </div>

          {/* Payment Method */}
          <div className="space-y-2 md:col-span-2">
            <Label className="text-gray-700 dark:text-gray-300 font-medium">Payment Method</Label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("stripe")}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === "stripe"
                    ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <CreditCard className="w-6 h-6 mx-auto mb-2 text-orange-500" />
                <p className="font-semibold text-sm text-gray-900 dark:text-white">Pay Online</p>
                <p className="text-xs text-gray-400">Stripe / Card</p>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("cod")}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === "cod"
                    ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <Banknote className="w-6 h-6 mx-auto mb-2 text-orange-500" />
                <p className="font-semibold text-sm text-gray-900 dark:text-white">Cash on Delivery</p>
                <p className="text-xs text-gray-400">Pay when you receive</p>
              </button>
            </div>
          </div>

          <DialogFooter className="col-span-1 md:col-span-2 pt-4">
            {loading ? (
              <Button disabled className="w-full bg-orange-500 h-12 rounded-lg">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
              </Button>
            ) : (
              <Button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 h-12 text-white font-semibold rounded-lg shadow-md shadow-orange-500/20">
                <CreditCard className="mr-2 h-4 w-4" />
                {paymentMethod === "cod" ? "Place Order (COD)" : "Continue To Payment"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutConfirmPage;