import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRestaurantStore } from "@/store/useRestaurantStore";
import { useEffect, useState } from "react";
import { Loader2, PackageOpen, MapPin, Mail, Calendar } from "lucide-react";

const Orders = () => {
  const { restaurantOrder, getRestaurantOrders, updateRestaurantOrder, loading } =
    useRestaurantStore();
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const handleStatusChange = async (id: string, status: string) => {
    setUpdatingOrderId(id);
    await updateRestaurantOrder(id, status.toLowerCase());
    setUpdatingOrderId(null);
  };

  useEffect(() => {
    getRestaurantOrders();
  }, [getRestaurantOrders]);

  const statusOptions = [
    { value: "pending", label: "Pending" },
    { value: "confirmed", label: "Confirmed" },
    { value: "preparing", label: "Preparing" },
    { value: "outfordelivery", label: "Out For Delivery" },
    { value: "delivered", label: "Delivered" },
  ];

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
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/60 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 py-10 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Orders Overview
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track and manage incoming customer orders
          </p>
        </div>

        {/* Loading State */}
        {loading && restaurantOrder.length === 0 && (
          <div className="flex justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        )}

        {/* Empty State */}
        {!loading && restaurantOrder.length === 0 && (
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
          {restaurantOrder.map((order) => (
            <div
              key={order._id}
              className="bg-white dark:bg-gray-800 shadow-sm hover:shadow-lg rounded-2xl p-6 border border-gray-100 dark:border-gray-700 transition-all duration-200"
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                {/* Order Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                      {order.deliveryDetails.name}
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
                      {order.deliveryDetails.email}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      {order.deliveryDetails.address}, {order.deliveryDetails.city}
                    </p>
                    <p className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      {formatDate(order.createdAt)}
                    </p>
                  </div>

                  <p className="text-lg font-bold mt-3 bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent inline-block">
                    {formatPrice(order.totalAmount)}
                  </p>

                  {/* Order Items */}
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      Items
                    </h3>
                    {order.cartItems.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400"
                      >
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-10 h-10 object-cover rounded-lg ring-1 ring-black/5"
                        />
                        <span>
                          {item.name}{" "}
                          <span className="text-gray-400 dark:text-gray-500">
                            × {item.quantity}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Update */}
                <div className="w-full lg:w-64 lg:pl-6 lg:border-l border-gray-100 dark:border-gray-700">
                  <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Update Status
                  </Label>
                  <Select
                    onValueChange={(newStatus) =>
                      handleStatusChange(order._id, newStatus)
                    }
                    defaultValue={order.status}
                    disabled={updatingOrderId === order._id}
                  >
                    <SelectTrigger className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-orange-500">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {statusOptions.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {updatingOrderId === order._id && (
                    <p className="text-xs text-orange-500 mt-2 flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Updating...
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Orders;