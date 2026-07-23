import { createBrowserRouter, RouterProvider, Navigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import Login from "./auth/Login";
import Signup from "./auth/Signup";
import VerifyEmail from "./auth/VerifyEmail";
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

// ======================= ROUTE GUARDS =======================

const ProtectedRoutes = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useUserStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.isVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  return <>{children}</>;
};

const AuthenticatedUser = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useUserStore();

  if (isAuthenticated && user?.isVerified) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// ======================= LIVE TRACKING WRAPPER =======================

function LiveTrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { orders }: any = useOrderStore();
  
  const order = orders?.find((o: any) => o._id === orderId);
  
  // FIX: Handle restaurant as string or object, use any type
  const restaurantCoords: [number, number] = (order as any)?.restaurant?.coordinates || [88.3639, 22.5726];
  const customerCoords: [number, number] = (order as any)?.deliveryAddress?.coordinates || [88.3639, 22.5726];
  
  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <LiveTracking 
        orderId={orderId || "demo"} 
        restaurantCoords={restaurantCoords} 
        customerCoords={customerCoords} 
      />
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
                console.log("Selected:", data);
                localStorage.setItem("selectedAddress", JSON.stringify(data));
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
        element: (
          <div className="max-w-2xl mx-auto py-10 px-4">
            <RestaurantDistanceChecker restaurantId="demo" />
          </div>
        ),
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
  {
    path: "/verify-email",
    element: (
      <AuthenticatedUser>
        <VerifyEmail />
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