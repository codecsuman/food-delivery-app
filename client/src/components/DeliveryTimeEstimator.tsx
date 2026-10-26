import { useEffect, useState } from "react";
import { Timer, MapPin, Navigation } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface DeliveryTimeEstimatorProps {
  restaurantId: string;
  customerCoords: {
    address: string;
    pincode: string;
    coordinates: [number, number];
  };
  /** Lets the checkout summary show the same server-calculated fee. */
  onQuote?: (quote: DeliveryQuote | null) => void;
}

export interface DeliveryQuote {
  success: boolean;
  distanceKm?: number;
  estimatedMinutes?: number;
  estimatedTimeFormatted?: string;
  deliverable?: boolean;
  withinRange?: boolean;
  maxRadius?: number;
  standardRadiusKm?: number;
  chargePerExtraKm?: number;
  baseFee?: number;
  extraDistanceKm?: number;
  extraFee?: number;
  deliveryFee?: number;
  message?: string;
}

const DeliveryTimeEstimator = ({ restaurantId, customerCoords, onQuote }: DeliveryTimeEstimatorProps) => {
  const [deliveryInfo, setDeliveryInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // BUG FIX: `customerCoords` is created inline by the parent, so it is a new
  // object on every render. Depending on the object caused an infinite
  // fetch → setState → re-render loop. Depend on its primitive values instead.
  const customerAddress = customerCoords?.address ?? "";
  const customerPincode = customerCoords?.pincode ?? "";
  const customerLng = customerCoords?.coordinates?.[0];
  const customerLat = customerCoords?.coordinates?.[1];
  const hasCoordinates =
    typeof customerLng === "number" &&
    typeof customerLat === "number" &&
    Number.isFinite(customerLng) &&
    Number.isFinite(customerLat) &&
    !(customerLng === 0 && customerLat === 0);

  useEffect(() => {
    if (!restaurantId || !customerAddress || !customerPincode) {
      setDeliveryInfo(null);
      setError("");
      setLoading(false);
      onQuote?.(null);
      return;
    }

    const controller = new AbortController();
    let active = true;

    const fetchDeliveryInfo = async () => {
      setLoading(true);
      setError("");
      setDeliveryInfo(null);

      try {
        const res = await fetch(`${API_BASE_URL}/map/check-delivery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            restaurantId,
            customerAddress,
            customerPincode,
            // Send the exact pin so the ETA matches the customer's selection
            // instead of a geocoder's approximation of the address text.
            ...(hasCoordinates ? { lat: customerLat, lng: customerLng } : {}),
          }),
        });
        const data = await res.json();
        if (!active) return;

        if (data.success) {
          setDeliveryInfo(data);
          onQuote?.(data as DeliveryQuote);
        } else {
          setError(data.message || "Failed to check delivery");
          onQuote?.(null);
        }
      } catch (err: any) {
        if (!active || err?.name === "AbortError") return;
        setError("Network error. Please try again.");
        onQuote?.(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchDeliveryInfo();

    return () => {
      active = false;
      controller.abort();
    };
  }, [restaurantId, customerAddress, customerPincode, customerLng, customerLat, hasCoordinates, onQuote]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl animate-pulse">
        <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-600" />
        <div className="space-y-2">
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-600 rounded" />
          <div className="h-3 w-16 bg-gray-200 dark:bg-gray-600 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/20">
        <MapPin className="w-5 h-5 text-red-500" />
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!deliveryInfo?.success) return null;

  const minutes = deliveryInfo.estimatedMinutes;
  const distance = deliveryInfo.distanceKm;
  const deliverable = deliveryInfo.deliverable;

  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border ${
      deliverable 
        ? "bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20" 
        : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20"
    }`}>
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
        deliverable ? "bg-orange-100 dark:bg-orange-500/20" : "bg-red-100 dark:bg-red-500/20"
      }`}>
        <Timer className={`w-6 h-6 ${deliverable ? "text-orange-500" : "text-red-500"}`} />
      </div>
      <div className="flex-1">
        {deliverable ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{minutes} min</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">delivery time</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              <span className="flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5" />
                {distance} km
              </span>
              {typeof deliveryInfo.deliveryFee === "number" && (
                <>
                  <span className="text-gray-300">|</span>
                  <span>Delivery ₹{deliveryInfo.deliveryFee}</span>
                </>
              )}
            </div>
            {typeof deliveryInfo.extraFee === "number" && deliveryInfo.extraFee > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Includes ₹{deliveryInfo.extraFee} for {deliveryInfo.extraDistanceKm} km beyond{" "}
                {deliveryInfo.standardRadiusKm} km
              </p>
            )}
          </>
        ) : (
          <>
            <p className="font-semibold text-red-600 dark:text-red-400">Delivery not available</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You're {distance} km away. Max delivery: {deliveryInfo.maxRadius} km
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default DeliveryTimeEstimator;