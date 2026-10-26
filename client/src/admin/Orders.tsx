import { Label } from "@/components/ui/label";
import { useRestaurantStore } from "@/store/useRestaurantStore";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { SOCKET_CONNECTION_OPTIONS, SOCKET_URL } from "@/lib/api";
import { getImageUrl, handleImageError } from "@/lib/placeholder";
import type { RestaurantOrderEvent } from "@/types/restaurantType";
import {
  Loader2,
  PackageOpen,
  MapPin,
  Mail,
  Calendar,
  Phone,
  Store,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

const Orders = () => {
  const {
    restaurantOrder,
    restaurantOrderError,
    getRestaurantOrders,
    updateRestaurantOrder,
    loading,
  } = useRestaurantStore();
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Step-by-step status flow matching backend exactly
  const STATUS_FLOW: Record<
    string,
    { next: string; label: string; color: string; icon: string }
  > = {
    pending: {
      next: "confirmed",
      label: "Confirm Order",
      color: "bg-green-500 hover:bg-green-600",
      icon: "✓",
    },
    confirmed: {
      next: "preparing",
      label: "Start Preparing",
      color: "bg-purple-500 hover:bg-purple-600",
      icon: "🍳",
    },
    preparing: {
      next: "outfordelivery",
      label: "Out for Delivery",
      color: "bg-blue-500 hover:bg-blue-600",
      icon: "🚚",
    },
    outfordelivery: {
      next: "delivered",
      label: "Mark Delivered",
      color: "bg-green-600 hover:bg-green-700",
      icon: "✓",
    },
    delivered: {
      next: "",
      label: "Completed",
      color: "bg-gray-400",
      icon: "✓",
    },
    cancelled: {
      next: "",
      label: "Cancelled",
      color: "bg-red-400",
      icon: "✕",
    },
    payment_failed: {
      next: "",
      label: "Payment Failed",
      color: "bg-red-400",
      icon: "✕",
    },
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (!newStatus) return;
    setUpdatingOrderId(id);
    await updateRestaurantOrder(id, newStatus);
    setUpdatingOrderId(null);
  };

  useEffect(() => {
    getRestaurantOrders();
  }, [getRestaurantOrders]);

  // Live updates: the server emits `order:new` / `order:status` to every
  // restaurant room this owner belongs to. `owner:join` asks the server to
  // resolve ownership, so the page does not need the restaurant ids first.
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      ...SOCKET_CONNECTION_OPTIONS,
      autoConnect: false,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsLive(true);
      socket.emit("owner:join");
    });
    socket.on("disconnect", () => setIsLive(false));
    socket.on("connect_error", () => setIsLive(false));

    socket.on("order:new", () => {
      getRestaurantOrders({ silent: true });
    });

    socket.on("order:status", (event: RestaurantOrderEvent) => {
      if (!event?.orderId) return;
      const { restaurantOrder, applyRestaurantOrderEvent } =
        useRestaurantStore.getState();
      if (restaurantOrder.some((order) => order._id === event.orderId)) {
        applyRestaurantOrderEvent(event);
      } else {
        // A new order we have not loaded yet (e.g. first event after login).
        getRestaurantOrders({ silent: true });
      }
    });

    const connectTimer = setTimeout(() => {
      if (socketRef.current === socket) socket.connect();
    }, 0);

    return () => {
      clearTimeout(connectTimer);
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [getRestaurantOrders]);

  // Fallback for environments where the socket cannot connect (proxy/CDN
  // blocks long-polling). The list still refreshes, just without instant
  // updates. Polling stops while the socket is connected.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (socketRef.current?.connected) return;
      getRestaurantOrders({ silent: true });
    }, 15000);

    return () => clearInterval(interval);
  }, [getRestaurantOrders]);

  // A tab that was in the background missed both polling and any socket
  // events, so refresh as soon as the owner comes back to it.
  useEffect(() => {
    const onFocus = () => getRestaurantOrders({ silent: true });
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [getRestaurantOrders]);

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
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

  const statusBadgeStyles = (status: string) => {
    switch (status) {
      case "delivered":
        return "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400";
      case "pending":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400";
      case "outfordelivery":
        return "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";
      case "preparing":
        return "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400";
      case "confirmed":
        return "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400";
      case "cancelled":
        return "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/60 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 py-10 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Orders Overview
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Track and manage incoming customer orders
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                isLive
                  ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
              }`}
              title={
                isLive
                  ? "Receiving live order updates"
                  : "Live updates unavailable — the list refreshes every 15 seconds"
              }
            >
              {isLive ? (
                <Wifi className="h-3.5 w-3.5" />
              ) : (
                <WifiOff className="h-3.5 w-3.5" />
              )}
              {isLive ? "Live" : "Auto-refresh"}
            </span>

            <button
              onClick={() => getRestaurantOrders()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-orange-300 hover:text-orange-600 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-orange-500/50 dark:hover:text-orange-400"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && restaurantOrder.length === 0 && (
          <div className="flex justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        )}

        {/* Error State — tells the owner why the list is empty instead of
            pretending there are simply no orders yet. */}
        {!loading && restaurantOrderError && (
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">Could not load your orders</p>
                <p className="mt-0.5">{restaurantOrderError}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 pl-8">
              <button
                onClick={() => getRestaurantOrders()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Try again
              </button>
              {restaurantOrderError.startsWith("No restaurant") && (
                <Link
                  to="/admin/restaurant"
                  className="font-semibold text-red-700 underline underline-offset-2 hover:text-red-800 dark:text-red-300"
                >
                  Create restaurant
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !restaurantOrderError && restaurantOrder.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-24 px-6 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30">
            <div className="h-14 w-14 rounded-full bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center mb-4">
              <PackageOpen className="h-7 w-7 text-orange-500" />
            </div>
            <p className="text-gray-600 dark:text-gray-300 font-medium">
              No orders yet
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Orders will appear here when customers place them
            </p>
          </div>
        )}

        {/* Orders List */}
        <div className="space-y-5">
          {restaurantOrder.map((order: any) => {
            const flow = STATUS_FLOW[order.status] || STATUS_FLOW.pending;
            const isFinal =
              order.status === "delivered" ||
              order.status === "cancelled" ||
              order.status === "payment_failed";

            // Backend returns cartItems, not items
            const items = order.cartItems || [];

            return (
              <div
                key={order._id}
                className="bg-white dark:bg-gray-800 shadow-sm hover:shadow-lg rounded-2xl p-6 border border-gray-100 dark:border-gray-700 transition-all duration-200"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  {/* Order Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                        {order.deliveryDetails?.name || "Customer"}
                      </h2>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${statusBadgeStyles(
                          order.status
                        )}`}
                      >
                        {order.status}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                      <p className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        {order.deliveryDetails?.email || "N/A"}
                      </p>
                      <p className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        {order.deliveryDetails?.address || "N/A"}
                        {order.deliveryDetails?.city ? `, ${order.deliveryDetails.city}` : ""}
                      </p>
                      <p className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        {order.createdAt ? formatDate(order.createdAt) : "N/A"}
                      </p>
                      {order.restaurant && typeof order.restaurant === "object" && (
                        <p className="flex items-center gap-2 flex-wrap">
                          <Store className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span>{order.restaurant.restaurantName}</span>
                          {order.restaurant.contact && (
                            <a
                              href={`tel:${order.restaurant.contact}`}
                              className="text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center gap-1"
                            >
                              <Phone className="h-3.5 w-3.5" />
                              {order.restaurant.contact}
                            </a>
                          )}
                          {order.restaurant.alternateContact && (
                            <span className="text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" />
                              Alt: {order.restaurant.alternateContact}
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    {order.status === "cancelled" && order.cancellationReason && (
                      <div className="mt-3 rounded-lg border border-red-100 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                        <p>{order.cancellationReason}</p>
                        {order.cancelledAt && (
                          <p className="mt-0.5 text-red-500/80 dark:text-red-400/80">
                            {formatDate(order.cancelledAt)}
                            {order.cancelledBy ? ` · ${order.cancelledBy}` : ""}
                          </p>
                        )}
                        {order.refundStatus && order.refundStatus !== "not_applicable" && (
                          <p className="mt-0.5">Refund: {order.refundStatus}</p>
                        )}
                      </div>
                    )}

                    <p className="text-lg font-bold mt-3 bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent inline-block">
                      {formatPrice(order.totalAmount || 0)}
                    </p>

                    {/* Order Items - using cartItems from backend */}
                    {items.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2.5">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                          Items
                        </h3>
                        {items.map((item: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400"
                          >
                            <img
                              src={getImageUrl(item.image)}
                              alt={item.name || "Item"}
                              className="w-10 h-10 object-cover rounded-lg ring-1 ring-black/5"
                              onError={handleImageError}
                            />
                            <span>
                              {item.name || "Unknown Item"}{" "}
                              <span className="text-gray-400 dark:text-gray-500">
                                × {item.quantity || 1}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Status Update - Step by Step */}
                  <div className="w-full lg:w-64 lg:pl-6 lg:border-l border-gray-100 dark:border-gray-700">
                    <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Update Status
                    </Label>

                    {isFinal ? (
                      <div
                        className={`w-full px-4 py-2.5 rounded-lg text-white text-sm font-semibold text-center ${flow.color}`}
                      >
                        {flow.label}
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() =>
                            handleStatusChange(order._id, flow.next)
                          }
                          disabled={updatingOrderId === order._id}
                          className={`w-full px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition-all disabled:opacity-50 ${flow.color}`}
                        >
                          {updatingOrderId === order._id ? (
                            <span className="flex items-center justify-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Updating...
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-2">
                              {flow.icon} {flow.label}
                            </span>
                          )}
                        </button>

                        {/* Cancel button */}
                        <button
                          onClick={() =>
                            handleStatusChange(order._id, "cancelled")
                          }
                          disabled={updatingOrderId === order._id}
                          className="w-full mt-2 px-4 py-2 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all disabled:opacity-50"
                        >
                          Cancel Order
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Orders;