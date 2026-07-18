import { IndianRupee, CheckCircle, Package, Clock, MapPin, User, Mail, Loader2 } from "lucide-react";
import { Separator } from "./ui/separator";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "./ui/button";
import { useOrderStore } from "@/store/useOrderStore";
import { useEffect, useState } from "react";
import { CartItem } from "@/types/cartType";

const Success = () => {
  const [searchParams] = useSearchParams();
  const { orders, getOrderDetails, getOrderBySessionId } = useOrderStore();
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      const sessionId = searchParams.get("session_id");

      if (sessionId) {
        const order = await getOrderBySessionId(sessionId);
        if (order) {
          setCurrentOrder(order);
        }
      } else {
        await getOrderDetails();
      }
      setLoading(false);
    };

    fetchOrder();
  }, [searchParams, getOrderBySessionId, getOrderDetails]);

  const order = currentOrder || orders[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-orange-50/60 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
          <h1 className="text-lg text-gray-600 dark:text-gray-300">
            Loading order details...
          </h1>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-orange-50/60 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 px-4">
        <div className="text-center">
          <div className="h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center mx-auto mb-5">
            <Package className="w-8 h-8 text-orange-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            Order not found!
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            We couldn't find your order details.
          </p>
          <Link to="/">
            <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-lg shadow-md shadow-orange-500/20">
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
      case "paid":
        return "text-green-600 dark:text-green-400";
      case "pending":
        return "text-yellow-600 dark:text-yellow-400";
      case "delivered":
        return "text-blue-600 dark:text-blue-400";
      default:
        return "text-orange-600 dark:text-orange-400";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
      case "paid":
        return "bg-green-50 dark:bg-green-500/10 border-green-100 dark:border-green-500/20";
      case "pending":
        return "bg-yellow-50 dark:bg-yellow-500/10 border-yellow-100 dark:border-yellow-500/20";
      case "delivered":
        return "bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20";
      default:
        return "bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/60 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 mb-6 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/30">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-2">
            Order Placed Successfully!
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Thank you for your order. We'll start preparing it right away.
          </p>
        </div>

        {/* Order Status */}
        <div className={`rounded-2xl p-6 mb-6 border ${getStatusBg(order.status)}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Order Status
              </p>
              <h2 className={`text-2xl font-extrabold mt-1 ${getStatusColor(order.status)}`}>
                {order.status?.toUpperCase() || "PENDING"}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Order ID
              </p>
              <p className="font-mono text-sm font-semibold text-gray-900 dark:text-white mt-1">
                #{order._id?.slice(-8).toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-4">
            Order Summary
          </h2>

          {/* Items */}
          <div className="space-y-4">
            {order.cartItems?.map((item: CartItem) => (
              <div key={item._id} className="flex items-center gap-4">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-16 h-16 rounded-xl object-cover ring-1 ring-black/5"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                    {item.name}
                  </h3>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Qty: {item.quantity}
                  </p>
                </div>
                <div className="flex items-center text-gray-900 dark:text-white font-bold shrink-0">
                  <IndianRupee className="w-4 h-4 mr-0.5" />
                  {item.price * item.quantity}
                </div>
              </div>
            ))}
          </div>

          <Separator className="my-6" />

          {/* Delivery Details */}
          <div className="mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">
              Delivery Details
            </h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <p className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                {order.deliveryDetails?.name}
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                {order.deliveryDetails?.address}, {order.deliveryDetails?.city}
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                {order.deliveryDetails?.email}
              </p>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Total */}
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold text-gray-900 dark:text-white">Total Amount</span>
            <span className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent flex items-center">
              <IndianRupee className="w-5 h-5" />
              {order.totalAmount}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Link to="/" className="flex-1">
            <Button className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 h-12 text-white font-semibold rounded-lg shadow-md shadow-orange-500/20">
              Continue Shopping
            </Button>
          </Link>
          <Link to="/order/success" className="flex-1">
            <Button
              variant="outline"
              className="w-full h-12 rounded-lg border-gray-200 dark:border-gray-600 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 hover:border-orange-200"
            >
              View All Orders
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Success;