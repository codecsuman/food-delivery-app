import { Dispatch, FormEvent, SetStateAction, useState, useEffect } from "react";
import { toast } from "sonner";
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
import { Loader2, MapPin, CreditCard, Banknote, Navigation } from "lucide-react";
import AddressPicker from "./AddressPicker";
import DeliveryTimeEstimator from "./DeliveryTimeEstimator";

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || "";

// A saved map selection is reused for convenience, but never forever: stale
// coordinates are exactly what made older deliveries show up at an old place.
const STORED_ADDRESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type SelectedAddress = {
  address: string;
  pincode: string;
  coordinates: [number, number]; // [lng, lat]
  formattedAddress?: string;
  city?: string;
  state?: string;
  country?: string;
  savedAt?: number;
};

const normalizeAddress = (value?: string) =>
  (value || "").replace(/\s+/g, " ").trim().toLowerCase();

const isValidCoordinates = (coords?: readonly number[] | null): coords is [number, number] => {
  if (!coords || coords.length < 2) return false;
  const [lng, lat] = coords;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return false;
  return !(lng === 0 && lat === 0);
};

const CheckoutConfirmPage = ({
  open, setOpen,
}: {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}) => {
  const { user } = useUserStore();
  const { cart } = useCartStore();
  const { restaurant, singleRestaurant } = useRestaurantStore();
  const { createCheckoutSession, loading } = useOrderStore();
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "cod">("stripe");
  const [useAddressPicker, setUseAddressPicker] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<SelectedAddress | null>(null);
  const [resolvingAddress, setResolvingAddress] = useState(false);

  const [input, setInput] = useState({
    name: "", email: "", address: "", city: "", country: "", pincode: "",
  });

  // BUG FIX: the checkout used to trust `useRestaurantStore().restaurant`,
  // which is the restaurant the *owner* last edited (and is persisted in
  // localStorage) — not necessarily the restaurant the cart belongs to.
  // Derive the restaurant from the cart items instead, and refuse mixed carts.
  const cartRestaurantIds = cart
    .map((item) =>
      typeof item.restaurant === "string"
        ? item.restaurant
        : item.restaurant?._id,
    )
    .filter((id): id is string => Boolean(id));

  const hasMixedRestaurants = new Set(cartRestaurantIds).size > 1;

  const cartRestaurantId =
    cartRestaurantIds[0] ||
    singleRestaurant?._id ||
    restaurant?._id ||
    null;

  // Prefer the restaurant currently being viewed (it has menus/deliveryPrice);
  // fall back to the owner store entry only when the IDs match.
  const checkoutRestaurant =
    (singleRestaurant && singleRestaurant._id === cartRestaurantId
      ? singleRestaurant
      : null) ||
    (restaurant && restaurant._id === cartRestaurantId ? restaurant : null);

  const deliveryPrice = checkoutRestaurant?.deliveryPrice || 0;
  const subtotal = cart.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0,
  );
  const total = subtotal + deliveryPrice;

  useEffect(() => {
    if (!user || !open) return;

    const profileInput = {
      name: user.fullname || "",
      email: user.email || "",
      address: user.address || "",
      city: user.city || "",
      country: user.country || "",
      pincode: user.pincode || "",
    };

    setInput(profileInput);
    setSelectedAddress(null);

    const stored = localStorage.getItem("selectedAddress");
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as SelectedAddress;
      const savedAt = Number(parsed.savedAt) || 0;
      const isFresh = savedAt > 0 && Date.now() - savedAt < STORED_ADDRESS_TTL_MS;
      const hasCoords = isValidCoordinates(parsed.coordinates);

      // Legacy entries have no savedAt — drop them instead of silently
      // delivering to coordinates saved months ago.
      if (!isFresh || !hasCoords || !parsed.address) {
        localStorage.removeItem("selectedAddress");
        return;
      }

      setSelectedAddress(parsed);
      setInput({
        ...profileInput,
        address: parsed.address,
        city: parsed.city || profileInput.city,
        country: parsed.country || profileInput.country,
        pincode: parsed.pincode || profileInput.pincode,
      });
    } catch {
      localStorage.removeItem("selectedAddress");
    }
  }, [user, open]);

  const changeEventHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInput((prev) => ({ ...prev, [name]: value }));

    // Editing the address/pincode invalidates the old pin. Clearing it forces
    // checkout to resolve fresh coordinates from the new address instead of
    // pairing a new address with an old lat/lng.
    if (name === "address" || name === "pincode") {
      setSelectedAddress(null);
    }
  };

  const handleAddressSelect = (data: {
    address: string;
    pincode: string;
    coordinates: [number, number];
    formattedAddress: string;
    city?: string;
    state?: string;
    country?: string;
  }) => {
    const saved: SelectedAddress = { ...data, savedAt: Date.now() };
    setSelectedAddress(saved);
    localStorage.setItem("selectedAddress", JSON.stringify(saved));

    setInput((prev) => ({
      ...prev,
      address: data.address,
      city: data.city || prev.city,
      country: data.country || prev.country,
      pincode: data.pincode || prev.pincode,
    }));
    setUseAddressPicker(false);
  };

  /**
   * Always resolve checkout coordinates from the *current* address text/pin.
   * - If the customer picked a pin and hasn't edited the address, use it.
   * - Otherwise ask the backend to geocode the current address, so a manual
   *   edit can never reuse an old saved lat/lng.
   */
  const resolveDeliveryAddress = async (): Promise<SelectedAddress | null> => {
    const pincode = (input.pincode || selectedAddress?.pincode || user?.pincode || "").trim();

    if (!/^\d{6}$/.test(pincode)) {
      toast.error("Please enter a valid 6-digit pincode");
      return null;
    }

    if (
      selectedAddress &&
      isValidCoordinates(selectedAddress.coordinates) &&
      normalizeAddress(selectedAddress.address) === normalizeAddress(input.address)
    ) {
      return { ...selectedAddress, pincode };
    }

    setResolvingAddress(true);
    try {
      const res = await fetch(`${API_BASE_URL}/map/validate-address`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address: input.address, pincode }),
      });
      const data = await res.json();

      if (!res.ok || !data.success || !isValidCoordinates(data.coordinates)) {
        toast.error(data.message || "Could not verify your delivery address");
        return null;
      }

      const resolved: SelectedAddress = {
        address: data.formattedAddress || input.address,
        formattedAddress: data.formattedAddress || input.address,
        pincode,
        coordinates: [data.coordinates[0], data.coordinates[1]],
        city: data.city || input.city,
        state: data.state || user?.state || "",
        country: data.country || input.country,
        savedAt: Date.now(),
      };

      setSelectedAddress(resolved);
      localStorage.setItem("selectedAddress", JSON.stringify(resolved));
      setInput((prev) => ({
        ...prev,
        address: resolved.address,
        city: resolved.city || prev.city,
        country: resolved.country || prev.country,
        pincode,
      }));

      return resolved;
    } catch {
      toast.error("Could not verify your delivery address. Please try again.");
      return null;
    } finally {
      setResolvingAddress(false);
    }
  };

  const checkoutHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!input.name || !input.address) {
      toast.error("Please enter your name and delivery address");
      return;
    }

    if (cart.length === 0) {
      toast.error("Your cart is empty");
      setOpen(false);
      return;
    }

    // A single order can only belong to one restaurant (the backend verifies
    // every menu item against that restaurant's menu).
    if (hasMixedRestaurants) {
      toast.error("Your cart contains items from multiple restaurants. Please keep items from one restaurant per order.");
      return;
    }

    if (!cartRestaurantId) {
      toast.error("Could not determine the restaurant for your cart. Please add the items again.");
      return;
    }

    // Resolve the CURRENT address/pin before ordering. This prevents an old
    // localStorage coordinate from being attached to an edited address.
    const resolvedAddress = await resolveDeliveryAddress();
    if (!resolvedAddress) {
      setUseAddressPicker(true);
      return;
    }

    // Prefer what the customer currently sees/edited. A restored pin may carry
    // an older geocoded city; the form value is the current intent.
    const city = input.city || resolvedAddress.city || user?.city || "";
    if (!city) {
      toast.error("Please enter your city");
      return;
    }

    try {
      const checkoutData: CheckoutSessionRequest = {
        cartItems: cart.map((cartItem) => ({
          menuId: cartItem._id, name: cartItem.name, image: cartItem.image,
          price: cartItem.price, quantity: cartItem.quantity,
        })),
        deliveryDetails: {
          name: input.name,
          email: input.email,
          address: resolvedAddress.address || input.address,
          city,
          pincode: resolvedAddress.pincode,
          lat: resolvedAddress.coordinates[1], // [lng, lat] -> lat
          lng: resolvedAddress.coordinates[0], // [lng, lat] -> lng
        },
        restaurantId: cartRestaurantId,
      };
      await createCheckoutSession(checkoutData, paymentMethod);
    } catch {
      // Checkout error - silent
    }
  };

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
          <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">Order Summary</h3>
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
          {hasMixedRestaurants && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2">
              Your cart has items from more than one restaurant. Please remove items so only one restaurant remains before checking out.
            </p>
          )}
        </div>

        {/* Delivery Time Estimator — only while the pin still matches the text */}
        {selectedAddress &&
          normalizeAddress(selectedAddress.address) === normalizeAddress(input.address) &&
          cartRestaurantId && (
          <div className="mb-4">
            <DeliveryTimeEstimator
              restaurantId={cartRestaurantId}
              customerCoords={{
                address: selectedAddress.address,
                pincode: selectedAddress.pincode,
                coordinates: selectedAddress.coordinates,
              }}
            />
          </div>
        )}

        {/* Address Input Toggle */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-500" />
              Delivery Address
            </Label>
            <button
              type="button"
              onClick={() => setUseAddressPicker(!useAddressPicker)}
              className="text-sm text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1"
            >
              <Navigation className="w-3.5 h-3.5" />
              {useAddressPicker ? "Use Manual Input" : "Use Map Picker"}
            </button>
          </div>

          {useAddressPicker ? (
            <div className="space-y-4">
              <AddressPicker
                onAddressSelect={handleAddressSelect}
                initialAddress={input.address}
                initialPincode={input.pincode || selectedAddress?.pincode || user?.pincode || ""}
                initialCoordinates={
                  isValidCoordinates(selectedAddress?.coordinates)
                    ? selectedAddress!.coordinates
                    : undefined
                }
              />
              {/* When using AddressPicker, we still need a form for payment method + submit */}
              <form onSubmit={checkoutHandler} className="space-y-4">
                {/* Hidden inputs to preserve form state */}
                <input type="hidden" name="name" value={input.name} />
                <input type="hidden" name="email" value={input.email} />
                <input type="hidden" name="address" value={input.address} />
                <input type="hidden" name="city" value={input.city} />
                <input type="hidden" name="country" value={input.country} />
                <input type="hidden" name="pincode" value={input.pincode} />
                
                <PaymentMethodSelector paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} />
                
                <DialogFooter>
                  {loading || resolvingAddress ? (
                    <Button disabled className="w-full bg-orange-500 h-12 rounded-lg">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {resolvingAddress ? "Checking address..." : "Processing..."}
                    </Button>
                  ) : (
                    <Button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 h-12 text-white font-semibold rounded-lg shadow-md shadow-orange-500/20">
                      <CreditCard className="mr-2 h-4 w-4" />
                      {paymentMethod === "cod" ? "Place Order (COD)" : "Continue To Payment"}
                    </Button>
                  )}
                </DialogFooter>
              </form>
            </div>
          ) : (
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
                <Label className="text-gray-700 dark:text-gray-300 font-medium">Pincode</Label>
                <Input
                  type="text"
                  name="pincode"
                  value={input.pincode}
                  onChange={changeEventHandler}
                  placeholder="6-digit pincode"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700 dark:text-gray-300 font-medium">Country</Label>
                <Input type="text" name="country" value={input.country} onChange={changeEventHandler} placeholder="Country" required className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500" />
              </div>

              <PaymentMethodSelector paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} />

              <DialogFooter className="col-span-1 md:col-span-2 pt-4">
                {loading || resolvingAddress ? (
                  <Button disabled className="w-full bg-orange-500 h-12 rounded-lg">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {resolvingAddress ? "Checking address..." : "Processing..."}
                  </Button>
                ) : (
                  <Button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 h-12 text-white font-semibold rounded-lg shadow-md shadow-orange-500/20">
                    <CreditCard className="mr-2 h-4 w-4" />
                    {paymentMethod === "cod" ? "Place Order (COD)" : "Continue To Payment"}
                  </Button>
                )}
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Extracted Payment Method Selector to avoid duplication
const PaymentMethodSelector = ({
  paymentMethod,
  setPaymentMethod,
}: {
  paymentMethod: "stripe" | "cod";
  setPaymentMethod: (m: "stripe" | "cod") => void;
}) => (
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
);

export default CheckoutConfirmPage;