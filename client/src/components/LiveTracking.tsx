import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { io, Socket } from "socket.io-client";
import { Truck, Clock, MapPin, Navigation, Package, ChefHat, CheckCircle2, CircleDot, AlertCircle } from "lucide-react";

// Fix Leaflet default marker icon
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface LiveTrackingProps {
  orderId: string;
  restaurantCoords: [number, number];
  customerCoords: [number, number];
  initialDriverCoords?: [number, number];
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:8001";

const STATUS_CONFIG: Record<string, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  progress: number;
}> = {
  pending: {
    label: "Order Placed",
    description: "Waiting for restaurant confirmation",
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-500/10",
    borderColor: "border-yellow-200 dark:border-yellow-500/20",
    progress: 10,
  },
  confirmed: {
    label: "Confirmed",
    description: "Restaurant confirmed your order",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-500/10",
    borderColor: "border-green-200 dark:border-green-500/20",
    progress: 25,
  },
  preparing: {
    label: "Preparing",
    description: "Restaurant is preparing your food",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-500/10",
    borderColor: "border-orange-200 dark:border-orange-500/20",
    progress: 45,
  },
  outfordelivery: {
    label: "On the Way",
    description: "Driver is heading to your location",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-500/10",
    borderColor: "border-blue-200 dark:border-blue-500/20",
    progress: 75,
  },
  delivered: {
    label: "Delivered",
    description: "Enjoy your meal!",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-500/10",
    borderColor: "border-green-200 dark:border-green-500/20",
    progress: 100,
  },
  cancelled: {
    label: "Cancelled",
    description: "Order has been cancelled",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-500/10",
    borderColor: "border-red-200 dark:border-red-500/20",
    progress: 0,
  },
};

const STATUS_FLOW = ["pending", "confirmed", "preparing", "outfordelivery", "delivered"];

const LiveTracking = ({
  orderId,
  restaurantCoords,
  customerCoords,
  initialDriverCoords = restaurantCoords,
}: LiveTrackingProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const driverMarker = useRef<L.Marker | null>(null);
  const routeLine = useRef<L.Polyline | null>(null);
  const socket = useRef<Socket | null>(null);

 const [, setDriverLocation] = useState<[number, number]>(initialDriverCoords);
  const [eta, setEta] = useState<number | null>(null);
  const [distanceRemaining, setDistanceRemaining] = useState<number | null>(null);
  const [status, setStatus] = useState("preparing");
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = L.map(mapContainer.current, {
      zoomControl: false,
    }).setView([customerCoords[1], customerCoords[0]], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map.current);

    L.control.zoom({ position: "bottomright" }).addTo(map.current);

    const restaurantIcon = L.divIcon({
      className: "custom-marker",
      html: '<div style="width:40px;height:40px;background:linear-gradient(135deg,#f97316,#f59e0b);border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(249,115,22,0.4);border:3px solid white;"><span style="transform:rotate(45deg);font-size:16px;">🏪</span></div>',
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    });

    L.marker([restaurantCoords[1], restaurantCoords[0]], { icon: restaurantIcon })
      .addTo(map.current)
      .bindPopup("<b>Restaurant</b><br>Your food is being prepared here");

    const customerIcon = L.divIcon({
      className: "custom-marker",
      html: '<div style="width:40px;height:40px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(34,197,94,0.4);border:3px solid white;"><span style="transform:rotate(45deg);font-size:16px;">🏠</span></div>',
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    });

    L.marker([customerCoords[1], customerCoords[0]], { icon: customerIcon })
      .addTo(map.current)
      .bindPopup("<b>Your Location</b><br>Delivery address");

    const driverIcon = L.divIcon({
      className: "custom-marker",
      html: '<div style="width:44px;height:44px;background:linear-gradient(135deg,#ef4444,#dc2626);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(239,68,68,0.5);border:3px solid white;animation:pulse 2s infinite;"><span style="font-size:18px;">🛵</span></div>',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    driverMarker.current = L.marker([initialDriverCoords[1], initialDriverCoords[0]], {
      icon: driverIcon,
    }).addTo(map.current).bindPopup("<b>Driver</b><br>On the way!");

    drawRoute(initialDriverCoords, customerCoords);

    socket.current = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socket.current.on("connect", () => {
      setIsConnected(true);
      socket.current?.emit("customer:join", { orderId });
    });

    socket.current.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.current.on("location:update", (data: any) => {
      const newLoc: [number, number] = [data.location.lng, data.location.lat];
      setDriverLocation(newLoc);
      setEta(data.eta);
      setDistanceRemaining(data.distanceRemaining);
      setStatus(data.status);

      if (driverMarker.current && map.current) {
        driverMarker.current.setLatLng([data.location.lat, data.location.lng]);
        drawRoute(newLoc, customerCoords);
      }
    });

    socket.current.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
      setIsConnected(false);
    });

    return () => {
      socket.current?.disconnect();
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  const drawRoute = async (from: [number, number], to: [number, number]) => {
    try {
      const res = await fetch("/api/v1/map/tracking/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          driverCoords: from,
          customerCoords: to,
        }),
      });
      const data = await res.json();

      if (data.success && map.current) {
        if (routeLine.current) map.current.removeLayer(routeLine.current);

        const latLngs = data.routeCoordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
        routeLine.current = L.polyline(latLngs as L.LatLngExpression[], {
          color: "#f97316",
          weight: 5,
          opacity: 0.85,
          dashArray: "12, 8",
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map.current);

        map.current.fitBounds(routeLine.current.getBounds(), {
          padding: [60, 60],
          maxZoom: 16,
        });
      }
    } catch (err) {
      console.error("Route error:", err);
    }
  };

  const currentStatus = STATUS_CONFIG[status] || STATUS_CONFIG.preparing;
  const currentStepIndex = STATUS_FLOW.indexOf(status);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-24">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Order Tracking
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Order #{orderId.slice(-8).toUpperCase()}
            </p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${isConnected ? "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700"}`}>
            <CircleDot className={`w-3 h-3 ${isConnected ? "animate-pulse" : ""}`} />
            {isConnected ? "Live" : "Reconnecting..."}
          </div>
        </div>

        {/* Status Card */}
        <div className={`rounded-2xl border p-5 ${currentStatus.bgColor} ${currentStatus.borderColor}`}>
          <div className="flex items-center gap-4">
            <div className={`h-12 w-12 rounded-xl ${currentStatus.bgColor} border ${currentStatus.borderColor} flex items-center justify-center shrink-0`}>
              {status === "pending" && <Clock className={`w-6 h-6 ${currentStatus.color}`} />}
              {status === "confirmed" && <CheckCircle2 className={`w-6 h-6 ${currentStatus.color}`} />}
              {status === "preparing" && <ChefHat className={`w-6 h-6 ${currentStatus.color}`} />}
              {status === "outfordelivery" && <Truck className={`w-6 h-6 ${currentStatus.color}`} />}
              {status === "delivered" && <CheckCircle2 className={`w-6 h-6 ${currentStatus.color}`} />}
              {status === "cancelled" && <AlertCircle className={`w-6 h-6 ${currentStatus.color}`} />}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className={`text-lg font-bold ${currentStatus.color}`}>
                {currentStatus.label}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {currentStatus.description}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-1000" style={{ width: `${currentStatus.progress}%` }} />
            </div>
            <div className="flex justify-between mt-2">
              {STATUS_FLOW.map((step, idx) => {
                const isCompleted = idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;
                return (
                  <div key={step} className="flex flex-col items-center gap-1">
                    <div className={`w-2.5 h-2.5 rounded-full transition-all ${isCompleted ? (isCurrent ? "bg-orange-500 ring-4 ring-orange-500/20 animate-pulse" : "bg-green-500") : "bg-gray-300 dark:bg-gray-600"}`} />
                    <span className={`text-[10px] font-medium uppercase tracking-wider ${isCompleted ? "text-gray-700 dark:text-gray-300" : "text-gray-400 dark:text-gray-500"}`}>
                      {step === "outfordelivery" ? "On Way" : step}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-500" />
              </div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Estimated Time</span>
            </div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {eta !== null ? eta : "--"}
              <span className="text-sm font-medium text-gray-400 ml-1">min</span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center">
                <Navigation className="w-5 h-5 text-blue-500" />
              </div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Distance</span>
            </div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {distanceRemaining !== null ? distanceRemaining.toFixed(1) : "--"}
              <span className="text-sm font-medium text-gray-400 ml-1">km</span>
            </div>
          </div>
        </div>

        {/* Map Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Live Location</h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
              {isConnected ? "Tracking active" : "Offline"}
            </div>
          </div>
          <div ref={mapContainer} className="h-80 w-full" style={{ minHeight: "320px" }} />
          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-center gap-6 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-gradient-to-br from-orange-500 to-amber-500" />
              <span>Restaurant</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-gradient-to-br from-green-500 to-emerald-500" />
              <span>You</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-gradient-to-br from-red-500 to-red-600 animate-pulse" />
              <span>Driver</span>
            </div>
          </div>
        </div>

        {/* Order Info */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-orange-500" />
            Order Details
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">Order ID</span>
              <span className="font-mono font-medium text-gray-900 dark:text-white">{orderId}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">Status</span>
              <span className={`font-medium capitalize ${currentStatus.color}`}>
                {status.replace(/([A-Z])/g, " $1").trim()}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500 dark:text-gray-400">Tracking</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {isConnected ? "Real-time updates" : "Waiting for connection..."}
              </span>
            </div>
          </div>
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
};

export default LiveTracking;