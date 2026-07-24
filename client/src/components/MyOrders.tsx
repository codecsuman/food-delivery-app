import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useOrderStore } from "@/store/useOrderStore";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import {
  HandPlatter,
  Clock,
  MapPin,
  Truck,
  ChevronRight,
  Loader2,
  PackageCheck,
  UtensilsCrossed,
  Navigation,
} from "lucide-react";

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: "bg-yellow-500", icon: <Clock className="w-3 h-3" />, label: "Pending" },
  confirmed: { color: "bg-green-500", icon: <PackageCheck className="w-3 h-3" />, label: "Confirmed" },
  preparing: { color: "bg-orange-500", icon: <UtensilsCrossed className="w-3 h-3" />, label: "Preparing" },
  outfordelivery: { color: "bg-blue-500", icon: <Truck className="w-3 h-3" />, label: "On the Way" },
  delivered: { color: "bg-green-600", icon: <PackageCheck className="w-3 h-3" />, label: "Delivered" },
  cancelled: { color: "bg-red-500", icon: <Clock className="w-3 h-3" />, label: "Cancelled" },
  payment_failed: { color: "bg-red-400", icon: <Clock className="w-3 h-3" />, label: "Payment Failed" },
};

const statusFlow = ["pending", "confirmed", "preparing", "outfordelivery", "delivered"];

const MyOrders = () => {
  const { orders, getOrderDetails, loading } = useOrderStore();
  const [activeTab, setActiveTab] = useState<"active" | "past">("active");

  useEffect(() => {
    getOrderDetails();
  }, [getOrderDetails]);

  const activeOrders = (orders || []).filter((o: any) =>
    ["pending", "confirmed", "preparing", "outfordelivery"].includes(o.status)
  );

  const pastOrders = (orders || []).filter((o: any) =>
    ["delivered", "cancelled", "payment_failed"].includes(o.status)
  );

  const displayOrders = activeTab === "active" ? activeOrders : pastOrders;

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
          My Orders
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Track and manage your food orders
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            activeTab === "active"
              ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          Active ({activeOrders.length})
        </button>
        <button
          onClick={() => setActiveTab("past")}
          className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            activeTab === "past"
              ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          Past ({pastOrders.length})
        </button>
      </div>

      {displayOrders.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
          <HandPlatter className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">
            No {activeTab} orders
          </h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            {activeTab === "active"
              ? "You don't have any active orders right now"
              : "Your order history will appear here"}
          </p>
          <Link to="/search">
            <Button className="mt-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl">
              Browse Restaurants
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {displayOrders.map((order: any) => {
            const status = statusConfig[order.status] || statusConfig.pending;
            const canTrack = ["confirmed", "preparing", "outfordelivery"].includes(order.status);
            const restaurantName = typeof order.restaurant === "string"
              ? "Restaurant"
              : order.restaurant?.restaurantName || "Restaurant";
            const restaurantId = typeof order.restaurant === "string"
              ? order.restaurant
              : order.restaurant?._id;
            const items = order.cartItems || [];
            const deliveryAddress = order.deliveryDetails?.address || "Delivery address";

            return (
              <div
                key={order._id}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`${status.color} text-white border-0 flex items-center gap-1`}>
                          {status.icon}
                          {status.label}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }) : "N/A"}
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                        {restaurantName}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {deliveryAddress}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-xl text-gray-900 dark:text-white">
                        ₹{order.totalAmount || 0}
                      </p>
                      <p className="text-xs text-gray-400">
                        {items.length} items
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {items.slice(0, 3).map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-300">
                          {item.quantity}x {item.name}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          ₹{(item.price || 0) * item.quantity}
                        </span>
                      </div>
                    ))}
                    {items.length > 3 && (
                      <p className="text-xs text-gray-400">
                        +{items.length - 3} more items
                      </p>
                    )}
                  </div>

                  <Separator className="my-4" />

                  <div className="flex items-center gap-3">
                    {canTrack && (
                      <Link to={`/track-order/${order._id}`} className="flex-1">
                        <Button className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 transition-all">
                          <Navigation className="w-4 h-4 mr-2" />
                          Track Order
                        </Button>
                      </Link>
                    )}
                    <Link to={`/restaurant/${restaurantId}`} className="flex-1">
                      <Button
                        variant="outline"
                        className="w-full rounded-xl border-gray-200 dark:border-gray-700 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition-all"
                      >
                        Reorder
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>

                {activeTab === "active" && (
                  <div className="px-5 pb-5">
                    <div className="flex items-center gap-1">
                      {statusFlow.map((step, idx) => {
                        const stepIndex = statusFlow.indexOf(order.status);
                        const isCompleted = idx <= stepIndex;
                        const isCurrent = idx === stepIndex;

                        return (
                          <div key={step} className="flex-1 flex items-center">
                            <div
                              className={`h-2 flex-1 rounded-full transition-all ${
                                isCompleted
                                  ? isCurrent
                                    ? "bg-gradient-to-r from-orange-500 to-amber-500 animate-pulse"
                                    : "bg-green-500"
                                  : "bg-gray-200 dark:bg-gray-700"
                              }`}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] text-gray-400 uppercase tracking-wider">
                      <span>Placed</span>
                      <span>Confirmed</span>
                      <span>Preparing</span>
                      <span>On Way</span>
                      <span>Delivered</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyOrders;