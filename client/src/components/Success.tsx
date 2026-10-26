import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCartStore } from "@/store/useCartStore";
import { useOrderStore } from "@/store/useOrderStore";
import { Orders } from "@/types/orderType";
import { Button } from "./ui/button";
import {
  CheckCircle,
  Truck,
  MapPin,
  Clock,
  ArrowRight,
  PackageCheck,
  Navigation,
  Loader2,
  RefreshCw,
  AlertCircle,
  Phone,
  Store,
} from "lucide-react";

// Statuses that mean payment has been captured / the order is valid.
const PAID_STATUSES = new Set([
  "confirmed",
  "preparing",
  "outfordelivery",
  "delivered",
]);

const Success = () => {
  const [searchParams] = useSearchParams();

  // BUG FIX: Stripe redirects back with `?session_id=cs_...`, not `orderId`.
  // The old page read only `orderId`, so the order could never be resolved,
  // the cart was cleared immediately, and the track button disappeared.
  const sessionId = searchParams.get("session_id");
  const orderIdParam = searchParams.get("orderId");

  const clearCart = useCartStore((state) => state.clearCart);
  const getOrderBySessionId = useOrderStore(
    (state) => state.getOrderBySessionId,
  );
  const getOrderById = useOrderStore((state) => state.getOrderById);

  const [order, setOrder] = useState<Orders | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const resolveOrder = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      let resolved: Orders | null = null;

      if (sessionId) {
        resolved = await getOrderBySessionId(sessionId);
      } else if (orderIdParam) {
        // COD orders already exist in the store; otherwise fetch them.
        resolved =
          useOrderStore
            .getState()
            .orders.find((candidate) => candidate._id === orderIdParam) ||
          (await getOrderById(orderIdParam));
      }

      if (!resolved) {
        setError(
          "We couldn't find this order yet. If you were charged, it will appear in My Orders shortly.",
        );
        return;
      }

      setOrder(resolved);

      // BUG FIX: only clear the cart once the order is actually confirmed.
      // Clearing it on mount (before payment verification) lost the cart for
      // cancelled/failed Stripe payments.
      if (PAID_STATUSES.has(resolved.status)) {
        clearCart();
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, orderIdParam, getOrderBySessionId, getOrderById, clearCart]);

  useEffect(() => {
    resolveOrder();
  }, [resolveOrder]);

  const orderId = order?._id || orderIdParam || "";
  const isPaid = order ? PAID_STATUSES.has(order.status) : false;
  const isPending = order?.status === "pending";
  const isCancelled = order?.status === "cancelled";
  const isFailed =
    order?.status === "payment_failed" || isCancelled;
  const restaurant =
    order && order.restaurant && typeof order.restaurant === "object"
      ? order.restaurant
      : null;
  // The snapshot is authoritative for historical orders; the populated
  // restaurant is only a fallback for orders created before snapshots existed.
  const restaurantName =
    order?.restaurantName || restaurant?.restaurantName || "";
  const restaurantContact =
    order?.restaurantContact ?? restaurant?.contact ?? null;
  const etaMinutes = order?.estimatedDeliveryMinutes;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-green-900/10 dark:to-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg p-10">
          <Loader2 className="w-10 h-10 animate-spin text-orange-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Confirming your order…
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Verifying your payment with Stripe. Please don't close this page.
          </p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white dark:from-gray-900 dark:to-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg p-8">
          <div className="w-16 h-16 mx-auto bg-amber-100 dark:bg-amber-500/10 rounded-full flex items-center justify-center mb-5">
            <AlertCircle className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">
            Order not found
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {error ||
              "No order information was provided. Check My Orders to see the latest status."}
          </p>
          <div className="space-y-3">
            <Button
              onClick={resolveOrder}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Check again
            </Button>
            <Link to="/my-orders" className="block">
              <Button variant="outline" className="w-full h-12 rounded-xl">
                View All Orders
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const iconClasses = isFailed
    ? "from-red-400 to-rose-500 shadow-red-500/30"
    : isPending
      ? "from-amber-400 to-orange-500 shadow-orange-500/30"
      : "from-green-400 to-emerald-500 shadow-green-500/30";

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-green-900/10 dark:to-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Success Animation */}
        <div className="relative mb-8">
          <div
            className={`w-24 h-24 mx-auto bg-gradient-to-br ${iconClasses} rounded-full flex items-center justify-center shadow-lg animate-bounce`}
          >
            {isFailed ? (
              <AlertCircle className="w-12 h-12 text-white" />
            ) : isPending ? (
              <Clock className="w-12 h-12 text-white" />
            ) : (
              <CheckCircle className="w-12 h-12 text-white" />
            )}
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 px-4 py-1 rounded-full shadow-sm border border-gray-100 dark:border-gray-700">
            <span
              className={`text-xs font-semibold ${
                isFailed
                  ? "text-red-600 dark:text-red-400"
                  : isPending
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-green-600 dark:text-green-400"
              }`}
            >
              {isCancelled
                ? "Order Cancelled"
                : isFailed
                  ? "Payment Not Completed"
                  : isPending
                    ? "Payment Processing"
                    : "Order Confirmed!"}
            </span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-3">
          {isCancelled
            ? "Order Cancelled"
            : isFailed
              ? "Something went wrong"
              : isPending
                ? "Almost there!"
                : "Thank You!"}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          {isCancelled
            ? order.cancellationReason ||
              "This order was cancelled. Check My Orders for details."
            : isFailed
              ? "Your payment was not completed, so the order was not confirmed. Your cart has been kept so you can try again."
              : isPending
                ? "We're waiting for the payment confirmation from Stripe. This usually takes a few seconds."
                : "Your order has been placed successfully. We're preparing your food with love!"}
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
                #{orderId.slice(-8).toUpperCase() || "N/A"}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {restaurantName && (
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <Store className="w-4 h-4 text-orange-500" />
                <span>
                  {restaurantName}
                  {restaurantContact ? (
                    <>
                      {" · "}
                      <a
                        href={`tel:${restaurantContact}`}
                        className="text-orange-600 dark:text-orange-400 font-medium hover:underline"
                      >
                        <Phone className="w-3.5 h-3.5 inline mr-1" />
                        {restaurantContact}
                      </a>
                    </>
                  ) : null}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
              <Clock className="w-4 h-4 text-orange-500" />
              <span>
                {isCancelled
                  ? order.cancelledAt
                    ? `Cancelled ${new Date(order.cancelledAt).toLocaleString("en-IN")}`
                    : "Order cancelled"
                  : isPaid
                    ? etaMinutes
                      ? `Estimated delivery: ${etaMinutes} minutes`
                      : "Estimated delivery: being confirmed"
                    : isPending
                      ? "Status: awaiting payment confirmation"
                      : "Status: payment failed / order cancelled"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
              <Truck className="w-4 h-4 text-orange-500" />
              <span>You'll receive updates on your order</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
              <MapPin className="w-4 h-4 text-orange-500" />
              <span>
                {order.deliveryDetails?.address
                  ? `Delivering to ${order.deliveryDetails.address}`
                  : "Delivering to your selected address"}
              </span>
            </div>
            {isCancelled &&
              (order.refundStatus === "pending" ||
                order.refundStatus === "refunded" ||
                order.refundStatus === "failed") && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  {order.refundStatus === "refunded"
                    ? "Your refund has been processed."
                    : order.refundStatus === "failed"
                      ? "The refund could not be issued automatically. Please contact support."
                      : "Your refund is being processed."}
                </div>
              )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {isPending && (
            <Button
              onClick={resolveOrder}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh payment status
            </Button>
          )}

          {isPaid && orderId && (
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

          <Link to={isFailed ? "/cart" : "/search"}>
            <Button
              variant="ghost"
              className="w-full h-12 rounded-2xl text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium transition-all"
            >
              {isFailed ? "Back to Cart" : "Continue Shopping"}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Success;
