import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
// FIX: Removed unused MapPin import
import { Navigation, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface RestaurantDistanceCheckerProps {
  restaurantId: string;
}

const RestaurantDistanceChecker = ({ restaurantId }: RestaurantDistanceCheckerProps) => {
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPincode, setCustomerPincode] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkDistance = async () => {
    setLoading(true);
    try {
      // First geocode customer address
      const geoRes = await fetch("/api/v1/map/validate-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: customerAddress, pincode: customerPincode }),
      });
      const geoData = await geoRes.json();

      if (!geoData.success) {
        setResult({ error: geoData.message });
        setLoading(false);
        return;
      }

      // Then get distance from restaurant
      const distRes = await fetch("/api/v1/map/restaurant/distance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restaurantId,
          customerCoords: geoData.coordinates,
        }),
      });
      const distData = await distRes.json();

      setResult({
        ...distData,
        customerAddress: geoData.formattedAddress,
        customerPincode,
      });
    } catch (err) {
      setResult({ error: "Failed to calculate distance" });
    }
    setLoading(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
          <Navigation className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white">Check Delivery Distance</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Verify if we deliver to a location</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-gray-700 dark:text-gray-300 font-medium mb-2 block">Customer Address</Label>
          <Input
            type="text"
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
            placeholder="Enter customer address"
            className="h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg"
          />
        </div>
        <div>
          <Label className="text-gray-700 dark:text-gray-300 font-medium mb-2 block">Pincode</Label>
          <Input
            type="text"
            value={customerPincode}
            onChange={(e) => setCustomerPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit pincode"
            maxLength={6}
            className="h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg"
          />
        </div>

        <Button
          onClick={checkDistance}
          disabled={loading || !customerAddress || customerPincode.length !== 6}
          className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-lg shadow-md shadow-orange-500/20 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              Calculating...
            </>
          ) : (
            "Check Distance"
          )}
        </Button>
      </div>

      {result && (
        <div className={`mt-6 p-4 rounded-xl border ${
          result.error
            ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20"
            : result.withinRange
            ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20"
            : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20"
        }`}>
          {result.error ? (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <XCircle className="w-5 h-5" />
              {result.error}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Distance</span>
                <span className="font-bold text-gray-900 dark:text-white">{result.distanceKm} km</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Delivery Time</span>
                <span className="font-bold text-gray-900 dark:text-white">{result.estimatedTimeFormatted}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
                <span className={`flex items-center gap-1.5 font-bold ${
                  result.withinRange ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}>
                  {result.withinRange ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      We Deliver Here!
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Out of Range
                    </>
                  )}
                </span>
              </div>
              {!result.withinRange && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Maximum delivery radius: {result.maxRadius} km
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RestaurantDistanceChecker;