import { createBrowserRouter, RouterProvider, Navigate, useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, Loader2 } from "lucide-react";
import Login from "./auth/Login";
import Signup from "./auth/Signup";
import Home from "./components/Home";
import MainLayout from "./layout/MainLayout";
import Profile from "./components/Profile";
import SearchPage from "./components/SearchPage";
import RestaurantDetail from "./components/RestaurantDetail";
import Cart from "./components/Cart";
import Restaurant from "./admin/Restaurant";
import AddMenu from "./admin/AddMenu";
import Orders from "./admin/Orders";
import Success from "./components/Success";
import MyOrders from "./components/MyOrders";
import Loading from "./components/Loading";

// Map & Delivery Components
import AddressPicker from "./components/AddressPicker";
import LiveTracking from "./components/LiveTracking";
import RestaurantDistanceChecker from "./components/RestaurantDistanceChecker";

// Static pages
import About from "./components/About";
import Contact from "./components/Contact";
import Privacy from "./components/Privacy";
import Terms from "./components/Terms";

import { useUserStore } from "./store/useUserStore";
import { useThemeStore } from "./store/useThemeStore";
import { useOrderStore } from "./store/useOrderStore";
import { useRestaurantStore } from "./store/useRestaurantStore";
import { Orders as OrderRecord } from "./types/orderType";

// ======================= ROUTE GUARDS =======================

const ProtectedRoutes = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useUserStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AuthenticatedUser = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useUserStore();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// ======================= LIVE TRACKING WRAPPER =======================

const isValidGeoCoords = (coords?: readonly number[] | null): coords is [number, number] => {
  if (!coords || coords.length < 2) return false;
  const [lng, lat] = coords;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return false;
  return !(lng === 0 && lat === 0);
};

function LiveTrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const orders = useOrderStore((state) => state.orders);
  const getOrderById = useOrderStore((state) => state.getOrderById);
  const pollOrderStatus = useOrderStore((state) => state.pollOrderStatus);
  const navigate = useNavigate();

  // The stored order is only used for an instant first paint. The effect below
  // always fetches a fresh copy so an old status/location from the store can
  // never be shown as current data.
  const orderFromStore = orderId
    ? orders.find((candidate) => candidate._id === orderId) ?? null
    : null;

  const [order, setOrder] = useState<OrderRecord | null>(orderFromStore);
  // Always wait for a fresh fetch before rendering/redirecting. A stale order
  // in the persisted store may have old coordinates or no coordinates at all.
  const [loading, setLoading] = useState(Boolean(orderId));

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    getOrderById(orderId)
      .then((fetched) => {
        if (active && fetched) setOrder(fetched);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // Intentionally does not depend on `orderFromStore`: getOrderById updates
    // the store, which would otherwise re-trigger this effect in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, getOrderById]);

  // Fallback polling keeps the status (and last known driver position) fresh
  // even when the Socket.IO connection is blocked by a network/proxy. Socket
  // events still update the map instantly; this just prevents stale data.
  useEffect(() => {
    if (loading || !orderId || !order) return;
    if (["delivered", "cancelled", "payment_failed"].includes(order.status)) return;

    let active = true;
    const interval = window.setInterval(async () => {
      const fresh = await pollOrderStatus(orderId, 10000);
      if (active && fresh) setOrder(fresh);
    }, 10000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [loading, orderId, order, pollOrderStatus]);

  // FIX: restaurant.location is GeoJSON — coordinates are already [lng, lat],
  // which is exactly the order LiveTracking.tsx expects. No flipping needed.
  const restaurant = order && typeof order.restaurant === "object"
    ? order.restaurant
    : null;
  const restaurantGeoCoords = restaurant?.location?.coordinates;
  const restaurantCoords: [number, number] | null = isValidGeoCoords(restaurantGeoCoords)
    ? [restaurantGeoCoords[0], restaurantGeoCoords[1]]
    : null;

  // FIX: deliveryDetails stores lat/lng as separate numeric fields.
  // Build them into [lng, lat] to match LiveTracking's expected order.
  const customerLat = order?.deliveryDetails?.lat;
  const customerLng = order?.deliveryDetails?.lng;
  const hasCustomerCoords =
    typeof customerLat === "number" &&
    typeof customerLng === "number" &&
    isValidGeoCoords([customerLng, customerLat]);
  const customerCoords: [number, number] | null = hasCustomerCoords
    ? [customerLng!, customerLat!]
    : null;

  // Prefer the position persisted by the tracking socket, then the latest
  // trackingHistory entry. This is what makes a refreshed tracking page show
  // the driver's current spot instead of resetting them to the restaurant.
  const latestHistory =
    order?.trackingHistory && order.trackingHistory.length > 0
      ? order.trackingHistory[order.trackingHistory.length - 1]
      : null;
  const initialDriverCoords: [number, number] | undefined =
    isValidGeoCoords(order?.driverLocation)
      ? [order!.driverLocation![0], order!.driverLocation![1]]
      : latestHistory && isValidGeoCoords(latestHistory.location)
        ? [latestHistory.location[0], latestHistory.location[1]]
        : undefined;
  const initialLocationAt =
    order?.driverLocationUpdatedAt || latestHistory?.timestamp || null;

  // If order doesn't have customer coordinates, redirect to address picker.
  // Wait for the fresh fetch first — a stale stored order may simply be missing
  // the fields that the server now returns.
  useEffect(() => {
    if (loading || !order) return;
    if (!hasCustomerCoords) {
      toast.error("Please set your delivery address to enable live tracking");
      navigate("/address-picker", { replace: true });
    }
  }, [loading, order, hasCustomerCoords, navigate]);

  // Wait for the fresh copy before rendering. This prevents a stale stored
  // order from briefly redirecting the user or showing the wrong map data.
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-4xl mx-auto py-10 px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center">
          <MapPin className="w-12 h-12 text-gray-300 dark:text-gray-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Order not found
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            We couldn't load this order. It may have been removed, or the link is invalid.
          </p>
          <button
            onClick={() => navigate("/my-orders")}
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold px-6 py-3 rounded-lg shadow-md"
          >
            View My Orders
          </button>
        </div>
      </div>
    );
  }

  if (!customerCoords) {
    return (
      <div className="max-w-4xl mx-auto py-10 px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center">
          <MapPin className="w-12 h-12 text-gray-300 dark:text-gray-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Delivery Address Required
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            To enable live order tracking, please set your delivery address first.
          </p>
          <button
            onClick={() => navigate("/address-picker")}
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold px-6 py-3 rounded-lg shadow-md"
          >
            Set Delivery Address
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      {!restaurantCoords && (
        <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          This restaurant hasn't saved a map location yet, so only your delivery
          location and the driver's live position can be shown.
        </div>
      )}
      <LiveTracking
        key={order._id}
        orderId={order._id}
        restaurantCoords={restaurantCoords}
        customerCoords={customerCoords}
        initialDriverCoords={initialDriverCoords}
        initialStatus={order.status}
        initialEta={order.currentEta ?? null}
        initialDistanceRemaining={order.currentDistance ?? null}
        initialLocationAt={initialLocationAt}
        restaurantName={order.restaurantName || restaurant?.restaurantName}
        restaurantContact={
          order.restaurantContact ?? restaurant?.contact ?? null
        }
        initialCancellationReason={order.cancellationReason ?? null}
      />
    </div>
  );
}

// ======================= DISTANCE CHECKER PAGE =======================

function DistanceCheckerPage() {
  const { restaurants, getUserRestaurants, loading } = useRestaurantStore();
  const [selectedId, setSelectedId] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (restaurants.length === 0) {
      getUserRestaurants();
    }
  }, [restaurants.length, getUserRestaurants]);

  useEffect(() => {
    if (restaurants.length === 0) {
      if (selectedId) setSelectedId("");
      return;
    }
    if (!restaurants.some((restaurant) => restaurant._id === selectedId)) {
      setSelectedId(restaurants[0]._id);
    }
  }, [restaurants, selectedId]);

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        Delivery Distance Checker
      </h1>

      {loading && restaurants.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : restaurants.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center">
          <MapPin className="w-12 h-12 text-gray-300 dark:text-gray-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            No restaurant found
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Create a restaurant first so its location can be used for distance checks.
          </p>
          <button
            onClick={() => navigate("/admin/restaurant")}
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold px-6 py-3 rounded-lg shadow-md"
          >
            Create Restaurant
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* BUG FIX: the route used to hard-code restaurantId="demo", which
              always failed backend ObjectId validation. Let owners pick one. */}
          <div>
            <label
              htmlFor="distance-restaurant"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Restaurant
            </label>
            <select
              id="distance-restaurant"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              className="w-full h-12 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {restaurants.map((restaurant) => (
                <option key={restaurant._id} value={restaurant._id}>
                  {restaurant.restaurantName} — {restaurant.city}
                </option>
              ))}
            </select>
          </div>

          {selectedId && (
            <RestaurantDistanceChecker restaurantId={selectedId} />
          )}
        </div>
      )}
    </div>
  );
}

// ======================= ROUTER =======================

const appRouter = createBrowserRouter([
  // Main app with protected routes
  {
    path: "/",
    element: (
      <ProtectedRoutes>
        <MainLayout />
      </ProtectedRoutes>
    ),
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/profile",
        element: <Profile />,
      },
      {
        path: "/search",
        element: <SearchPage />,
      },
      {
        path: "/search/:text",
        element: <SearchPage />,
      },
      {
        path: "/restaurant/:id",
        element: <RestaurantDetail />,
      },
      {
        path: "/cart",
        element: <Cart />,
      },
      {
        path: "/order/success",
        element: <Success />,
      },
      {
        path: "/my-orders",
        element: <MyOrders />,
      },
      // ===== MAP & DELIVERY ROUTES =====
      {
        path: "/address-picker",
        element: (
          <div className="max-w-2xl mx-auto py-10 px-4">
            <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
              Pick Delivery Address
            </h1>
            <AddressPicker
              onAddressSelect={(data) => {
                localStorage.setItem(
                  "selectedAddress",
                  JSON.stringify({ ...data, savedAt: Date.now() }),
                );
              }}
            />
          </div>
        ),
      },
      {
        path: "/track-order/:orderId",
        element: <LiveTrackingPage />,
      },
      {
        path: "/admin/distance-checker",
        element: <DistanceCheckerPage />,
      },
      // Static pages
      {
        path: "/about",
        element: <About />,
      },
      {
        path: "/contact",
        element: <Contact />,
      },
      {
        path: "/privacy",
        element: <Privacy />,
      },
      {
        path: "/terms",
        element: <Terms />,
      },
      // Admin routes
      {
        path: "/admin/restaurant",
        element: <Restaurant />,
      },
      {
        path: "/admin/menu",
        element: <AddMenu />,
      },
      {
        path: "/admin/orders",
        element: <Orders />,
      },
    ],
  },
  // Auth routes
  {
    path: "/login",
    element: (
      <AuthenticatedUser>
        <Login />
      </AuthenticatedUser>
    ),
  },
  {
    path: "/signup",
    element: (
      <AuthenticatedUser>
        <Signup />
      </AuthenticatedUser>
    ),
  },
  // Catch-all 404
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

// ======================= APP COMPONENT =======================

function App() {
  const initializeTheme = useThemeStore((state: any) => state.initializeTheme);
  const { checkAuthentication, isCheckingAuth } = useUserStore();

  useEffect(() => {
    checkAuthentication();
    initializeTheme();
  }, [checkAuthentication, initializeTheme]);

  if (isCheckingAuth) return <Loading />;

  return (
    <main>
      <RouterProvider router={appRouter} />
    </main>
  );
}

export default App;