import { useEffect, useState } from "react";
import { Timer, MapPin, Navigation } from "lucide-react";

interface DeliveryTimeEstimatorProps {
  restaurantId: string;
  customerCoords: {
    address: string;
    pincode: string;
    coordinates: [number, number];
  };
}

const DeliveryTimeEstimator = ({ restaurantId, customerCoords }: DeliveryTimeEstimatorProps) => {
  const [deliveryInfo, setDeliveryInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDeliveryInfo = async () => {
      try {
        const res = await fetch("/api/v1/map/check-delivery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurantId,
            customerAddress: customerCoords.address,
            customerPincode: customerCoords.pincode,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setDeliveryInfo(data);
        } else {
          setError(data.message || "Failed to check delivery");
        }
      } catch (err) {
        console.error(err);
        setError("Network error. Please try again.");
      }
      setLoading(false);
    };

    if (customerCoords?.address && customerCoords?.pincode) {
      fetchDeliveryInfo();
    } else {
      setLoading(false);
    }
  }, [restaurantId, customerCoords]);

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
              <span className="text-gray-300">|</span>
              <span>1 km = 3 min</span>
            </div>
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