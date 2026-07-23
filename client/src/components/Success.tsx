import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCartStore } from "@/store/useCartStore";
import { Button } from "./ui/button";
import {
  CheckCircle,
  Truck,
  MapPin,
  Clock,
  ArrowRight,
  PackageCheck,
  Navigation,
} from "lucide-react";

const Success = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const { clearCart } = useCartStore();

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-green-900/10 dark:to-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Success Animation */}
        <div className="relative mb-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 animate-bounce">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 px-4 py-1 rounded-full shadow-sm border border-gray-100 dark:border-gray-700">
            <span className="text-xs font-semibold text-green-600 dark:text-green-400">
              Order Confirmed!
            </span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-3">
          Thank You!
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          Your order has been placed successfully. We're preparing your food with love!
        </p>

        {/* Order Details Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg p-6 mb-6 text-left">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
              <PackageCheck className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Order ID</p>
              <p className="font-bold text-gray-900 dark:text-white font-mono">
                #{orderId?.slice(-8).toUpperCase() || "N/A"}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
              <Clock className="w-4 h-4 text-orange-500" />
              <span>Estimated delivery: 30-45 minutes</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
              <Truck className="w-4 h-4 text-orange-500" />
              <span>You'll receive updates on your order</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
              <MapPin className="w-4 h-4 text-orange-500" />
              <span>Delivering to your selected address</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {orderId && (
            <Link to={`/track-order/${orderId}`}>
              <Button className="w-full h-14 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-lg rounded-2xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all hover:scale-[1.02] active:scale-[0.98]">
                <Navigation className="w-5 h-5 mr-2" />
                Track Your Order
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          )}

          <Link to="/my-orders">
            <Button
              variant="outline"
              className="w-full h-12 rounded-2xl border-gray-200 dark:border-gray-700 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 font-semibold transition-all"
            >
              View All Orders
            </Button>
          </Link>

          <Link to="/search">
            <Button
              variant="ghost"
              className="w-full h-12 rounded-2xl text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium transition-all"
            >
              Continue Shopping
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Success;