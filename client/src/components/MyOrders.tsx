import { useOrderStore } from "@/store/useOrderStore";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import {
  Loader2,
  PackageOpen,
  Calendar,
  MapPin,
  IndianRupee,
  ChevronRight,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  ShoppingBag,
} from "lucide-react";

const MyOrders = () => {
  const { orders, getOrderDetails, loading } = useOrderStore();
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    getOrderDetails();
  }, [getOrderDetails]);

  const filteredOrders =
    filterStatus === "all"
      ? orders
      : orders.filter((o) => o.status === filterStatus);

  const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
    all: { label: "All Orders", icon: <ShoppingBag className="w-4 h-4" />, color: "text-gray-700 dark:text-gray-300", bg: "bg-gray-100 dark:bg-gray-700" },
    pending: { label: "Pending", icon: <Clock className="w-4 h-4" />, color: "text-yellow-700 dark:text-yellow-400", bg: "bg-yellow-100 dark:bg-yellow-500/10" },
    confirmed: { label: "Confirmed", icon: <CheckCircle2 className="w-4 h-4" />, color: "text-green-700 dark:text-green-400", bg: "bg-green-100 dark:bg-green-500/10" },
    preparing: { label: "Preparing", icon: <Loader2 className="w-4 h-4" />, color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-500/10" },
    outfordelivery: { label: "Out for Delivery", icon: <Truck className="w-4 h-4" />, color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-500/10" },
    delivered: { label: "Delivered", icon: <CheckCircle2 className="w-4 h-4" />, color: "text-green-700 dark:text-green-400", bg: "bg-green-100 dark:bg-green-500/10" },
    cancelled: { label: "Cancelled", icon: <XCircle className="w-4 h-4" />, color: "text-red-700 dark:text-red-400", bg: "bg-red-100 dark:bg-red-500/10" },
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/60 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 py-10 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            My Orders
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {orders.length} {orders.length === 1 ? "order" : "orders"} placed
          </p>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {Object.entries(statusConfig).map(([key, config]) => {
            const count =
              key === "all"
                ? orders.length
                : orders.filter((o) => o.status === key).length;
            const isActive = filterStatus === key;
            return (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  isActive
                    ? `${config.bg} ${config.color} ring-2 ring-orange-500/30`
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                {config.icon}
                {config.label}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    isActive
                      ? "bg-white/60 dark:bg-black/20"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Loading */}
        {loading && orders.length === 0 && (
          <div className="flex justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        )}

        {/* Empty State */}
        {!loading && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-24 px-6 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30">
            <div className="h-14 w-14 rounded-full bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center mb-4">
              <PackageOpen className="h-7 w-7 text-orange-500" />
            </div>
            <p className="text-gray-600 dark:text-gray-300 font-medium">
              No orders yet
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 mb-6">
              Start ordering from your favorite restaurants
            </p>
            <Link to="/search">
              <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-lg shadow-md shadow-orange-500/20">
                Browse Restaurants
              </Button>
            </Link>
          </div>
        )}

        {/* Orders List */}
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Link
              key={order._id}
              to={`/order/success?order_id=${order._id}`}
              className="block group"
            >
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-200 hover:-translate-y-0.5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Order Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-mono text-sm font-semibold text-gray-500 dark:text-gray-400">
                        #{order._id?.slice(-8).toUpperCase()}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                          statusConfig[order.status]?.bg || "bg-gray-100 dark:bg-gray-700"
                        } ${
                          statusConfig[order.status]?.color || "text-gray-700 dark:text-gray-400"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(order.createdAt)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {order.deliveryDetails?.city}
                      </span>
                    </div>

                    {/* Items preview */}
                    <div className="flex items-center gap-2 mt-3">
                      {order.cartItems?.slice(0, 3).map((item: any, idx: number) => (
                        <img
                          key={idx}
                          src={item.image}
                          alt={item.name}
                          className="w-10 h-10 rounded-lg object-cover ring-1 ring-black/5"
                        />
                      ))}
                      {order.cartItems?.length > 3 && (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-500 dark:text-gray-400">
                          +{order.cartItems.length - 3}
                        </div>
                      )}
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                        {order.cartItems?.length} {order.cartItems?.length === 1 ? "item" : "items"}
                      </span>
                    </div>
                  </div>

                  {/* Right: Total + Arrow */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">
                        Total
                      </p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white flex items-center justify-end">
                        <IndianRupee className="w-4 h-4" />
                        {order.totalAmount}
                      </p>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-all">
                      <ChevronRight className="w-5 h-5 text-orange-500 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MyOrders;