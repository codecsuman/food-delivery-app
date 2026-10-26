import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { io, Socket } from "socket.io-client";
import { API_BASE_URL, SOCKET_URL } from "@/lib/api";
import { Truck, Clock, MapPin, Navigation, Package, ChefHat, CheckCircle2, CircleDot, AlertCircle, Phone, Store } from "lucide-react";

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

const isValidCoords = (coords?: readonly number[] | null): coords is [number, number] => {
  if (!coords || coords.length < 2) return false;
  const [lng, lat] = coords;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return false;
  if (lng === 0 && lat === 0) return false;
  return true;
};

const RESTAURANT_ICON = L.divIcon({
  className: "custom-marker",
  html: '<div style="width:40px;height:40px;background:linear-gradient(135deg,#f97316,#f59e0b);border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(249,115,22,0.4);border:3px solid white;"><span style="transform:rotate(45deg);font-size:16px;">🏪</span></div>',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

const CUSTOMER_ICON = L.divIcon({
  className: "custom-marker",
  html: '<div style="width:40px;height:40px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(34,197,94,0.4);border:3px solid white;"><span style="transform:rotate(45deg);font-size:16px;">🏠</span></div>',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

const DRIVER_ICON = L.divIcon({
  className: "custom-marker",
  html: '<div style="width:44px;height:44px;background:linear-gradient(135deg,#ef4444,#dc2626);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(239,68,68,0.5);border:3px solid white;animation:pulse 2s infinite;"><span style="font-size:18px;">🛵</span></div>',
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

interface TrackingSnapshotPayload {
  location?: { lat: number; lng: number };
  status?: string;
  eta?: number | null;
  distanceRemaining?: number | null;
  timestamp?: string;
}

interface OrderStatusPayload {
  status?: string;
  cancellationReason?: string | null;
}

interface LiveTrackingProps {
  orderId: string;
  restaurantCoords?: [number, number] | null;
  customerCoords: [number, number];
  /** Last known driver position, passed by the tracking page after a refresh. */
  initialDriverCoords?: [number, number];
  /** Actual order status, so the UI doesn't default to "preparing". */
  initialStatus?: string;
  initialEta?: number | null;
  initialDistanceRemaining?: number | null;
  initialLocationAt?: string | Date | null;
  restaurantName?: string;
  restaurantContact?: number | null;
  initialCancellationReason?: string | null;
}

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
  restaurantCoords = null,
  customerCoords,
  initialDriverCoords,
  initialStatus = "preparing",
  initialEta = null,
  initialDistanceRemaining = null,
  initialLocationAt = null,
  restaurantName,
  restaurantContact = null,
  initialCancellationReason = null,
}: LiveTrackingProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const restaurantMarker = useRef<L.Marker | null>(null);
  const customerMarker = useRef<L.Marker | null>(null);
  const driverMarker = useRef<L.Marker | null>(null);
  const routeLine = useRef<L.Polyline | null>(null);
  const socket = useRef<Socket | null>(null);

  // Refs keep socket callbacks and route requests on the *current* coordinates
  // instead of the values captured when the map was first created.
  const customerCoordsRef = useRef<[number, number]>(customerCoords);
  const driverCoordsRef = useRef<[number, number] | null>(
    isValidCoords(initialDriverCoords) ? initialDriverCoords : null,
  );
  const receivedLiveDriverRef = useRef(false);
  const routeRequestId = useRef(0);
  const hasFitRoute = useRef(false);
  // Server timestamp of the newest position applied to the map. Prevents an
  // older polled response from moving the driver backwards after a socket
  // event (or after a reconnect).
  const initialLocationDate = initialLocationAt ? new Date(initialLocationAt) : null;
  const initialLocationTime =
    initialLocationDate && !Number.isNaN(initialLocationDate.getTime())
      ? initialLocationDate.getTime()
      : 0;
  const lastAppliedAtRef = useRef<number>(initialLocationTime);

  const [driverPosition, setDriverPosition] = useState<[number, number] | null>(
    isValidCoords(initialDriverCoords) ? initialDriverCoords : null,
  );
  const [eta, setEta] = useState<number | null>(initialEta);
  const [distanceRemaining, setDistanceRemaining] = useState<number | null>(initialDistanceRemaining);
  const [status, setStatus] = useState(initialStatus);
  const [cancellationReason, setCancellationReason] = useState<string | null>(
    initialCancellationReason,
  );
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
    if (!initialLocationAt) return null;
    const parsed = new Date(initialLocationAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  });

  customerCoordsRef.current = customerCoords;

  const fitToDriverAndCustomer = (driverCoords: [number, number]) => {
    if (!map.current || hasFitRoute.current) return;
    if (!isValidCoords(customerCoordsRef.current)) return;

    const bounds = L.latLngBounds(
      [customerCoordsRef.current[1], customerCoordsRef.current[0]],
      [driverCoords[1], driverCoords[0]],
    );
    map.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    hasFitRoute.current = true;
  };

  const drawRoute = async (from: [number, number], to: [number, number]) => {
    if (!isValidCoords(from) || !isValidCoords(to)) return;
    const requestId = ++routeRequestId.current;

    try {
      const res = await fetch(`${API_BASE_URL}/map/tracking/route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          driverCoords: from,
          customerCoords: to,
        }),
      });
      const data = await res.json();

      // Ignore responses from an older position (fast GPS updates can make
      // requests resolve out of order).
      if (requestId !== routeRequestId.current) return;
      if (!data.success || !map.current) return;

      if (routeLine.current) map.current.removeLayer(routeLine.current);

      const latLngs = (data.routeCoordinates || []).map(
        (coord: [number, number]) => [coord[1], coord[0]] as [number, number],
      );
      if (latLngs.length < 2) return;

      routeLine.current = L.polyline(latLngs as L.LatLngExpression[], {
        color: "#f97316",
        weight: 5,
        opacity: 0.85,
        dashArray: "12, 8",
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map.current);
    } catch {
      // Route error - silent; the marker still updates.
    }
  };

  const applyDriverLocation = (
    coords: [number, number],
    options: { live?: boolean; at?: string | Date | null; fromParent?: boolean } = {},
  ) => {
    if (!isValidCoords(coords)) return;

    const parsedAt = options.at ? new Date(options.at) : null;
    const incomingAt =
      parsedAt && !Number.isNaN(parsedAt.getTime()) ? parsedAt.getTime() : 0;

    // A polled response may resolve after a newer socket event. Ignore it
    // unless it is genuinely newer (or has no timestamp at all).
    if (
      options.fromParent &&
      incomingAt > 0 &&
      lastAppliedAtRef.current > 0 &&
      incomingAt <= lastAppliedAtRef.current
    ) {
      return;
    }

    if (options.live) receivedLiveDriverRef.current = true;
    if (incomingAt > lastAppliedAtRef.current) {
      lastAppliedAtRef.current = incomingAt;
    }

    driverCoordsRef.current = [coords[0], coords[1]];
    setDriverPosition([coords[0], coords[1]]);
    if (options.live) {
      setLastUpdated(parsedAt && !Number.isNaN(parsedAt.getTime()) ? parsedAt : new Date());
    }

    if (map.current) {
      const latLng: L.LatLngExpression = [coords[1], coords[0]];
      if (driverMarker.current) {
        driverMarker.current.setLatLng(latLng);
      } else {
        driverMarker.current = L.marker(latLng, { icon: DRIVER_ICON })
          .addTo(map.current)
          .bindPopup("<b>Driver</b><br>Live location");
      }
    }

    // Fit once when the driver first appears. This also works when the route
    // service is unavailable, so the driver's marker can never be off-screen.
    fitToDriverAndCustomer([coords[0], coords[1]]);

    void drawRoute([coords[0], coords[1]], customerCoordsRef.current);
  };

  // ======================= MAP SETUP (once) =======================
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const instance = L.map(mapContainer.current, {
      zoomControl: false,
    }).setView([customerCoords[1], customerCoords[0]], 13);

    map.current = instance;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(instance);

    L.control.zoom({ position: "bottomright" }).addTo(instance);

    if (isValidCoords(restaurantCoords)) {
      restaurantMarker.current = L.marker([restaurantCoords[1], restaurantCoords[0]], {
        icon: RESTAURANT_ICON,
      })
        .addTo(instance)
        .bindPopup("<b>Restaurant</b><br>Your food was prepared here");
    }

    customerMarker.current = L.marker([customerCoords[1], customerCoords[0]], {
      icon: CUSTOMER_ICON,
    })
      .addTo(instance)
      .bindPopup("<b>Your Location</b><br>Delivery address");

    // Before the driver starts sharing GPS, show the restaurant → customer
    // pair so the map isn't stuck on a single point (or a stale city).
    if (isValidCoords(restaurantCoords) && !driverCoordsRef.current) {
      const initialBounds = L.latLngBounds(
        [customerCoords[1], customerCoords[0]],
        [restaurantCoords[1], restaurantCoords[0]],
      );
      instance.fitBounds(initialBounds, { padding: [60, 60], maxZoom: 16 });
    }

    if (driverCoordsRef.current) {
      const driverCoords = driverCoordsRef.current;
      driverMarker.current = L.marker([driverCoords[1], driverCoords[0]], {
        icon: DRIVER_ICON,
      })
        .addTo(instance)
        .bindPopup("<b>Driver</b><br>Live location");
      fitToDriverAndCustomer(driverCoords);
      void drawRoute(driverCoords, customerCoordsRef.current);
    }

    return () => {
      instance.remove();
      map.current = null;
      restaurantMarker.current = null;
      customerMarker.current = null;
      driverMarker.current = null;
      routeLine.current = null;
      hasFitRoute.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the restaurant marker in sync when the order is refreshed and the
  // restaurant's saved location has changed.
  useEffect(() => {
    if (!map.current) return;

    if (!isValidCoords(restaurantCoords)) {
      if (restaurantMarker.current) {
        map.current.removeLayer(restaurantMarker.current);
        restaurantMarker.current = null;
      }
      return;
    }

    const latLng: L.LatLngExpression = [restaurantCoords[1], restaurantCoords[0]];
    if (restaurantMarker.current) {
      restaurantMarker.current.setLatLng(latLng);
    } else {
      restaurantMarker.current = L.marker(latLng, { icon: RESTAURANT_ICON })
        .addTo(map.current)
        .bindPopup("<b>Restaurant</b><br>Your food was prepared here");
    }
  }, [restaurantCoords?.[0], restaurantCoords?.[1]]);

  // Keep the customer marker + route origin in sync when a refreshed order
  // supplies updated delivery coordinates.
  useEffect(() => {
    customerCoordsRef.current = customerCoords;
    if (!map.current) return;

    const latLng: L.LatLngExpression = [customerCoords[1], customerCoords[0]];
    if (customerMarker.current) {
      customerMarker.current.setLatLng(latLng);
    } else {
      customerMarker.current = L.marker(latLng, { icon: CUSTOMER_ICON })
        .addTo(map.current)
        .bindPopup("<b>Your Location</b><br>Delivery address");
    }

    if (driverCoordsRef.current) {
      void drawRoute(driverCoordsRef.current, customerCoords);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerCoords[0], customerCoords[1]]);

  // Apply the last known driver position passed by the page (after a refresh
  // or from the polling fallback). Newer live socket events always win.
  useEffect(() => {
    if (!isValidCoords(initialDriverCoords)) return;
    if (
      driverCoordsRef.current &&
      driverCoordsRef.current[0] === initialDriverCoords[0] &&
      driverCoordsRef.current[1] === initialDriverCoords[1]
    ) {
      return;
    }
    applyDriverLocation(initialDriverCoords, {
      fromParent: true,
      at: initialLocationAt,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDriverCoords?.[0], initialDriverCoords?.[1], initialLocationAt]);

  // Keep the status/ETA in sync when the parent polls a fresher order.
  useEffect(() => {
    setStatus(initialStatus || "preparing");
  }, [initialStatus]);

  useEffect(() => {
    setCancellationReason(initialCancellationReason);
  }, [initialCancellationReason]);

  useEffect(() => {
    // While the socket is connected it pushes ETAs more frequently than the
    // 10s poll; once it disconnects, let the polled order take over again.
    if (isConnected && receivedLiveDriverRef.current) return;
    if (initialEta != null) setEta(initialEta);
  }, [initialEta, isConnected]);

  useEffect(() => {
    if (isConnected && receivedLiveDriverRef.current) return;
    if (initialDistanceRemaining != null) setDistanceRemaining(initialDistanceRemaining);
  }, [initialDistanceRemaining, isConnected]);

  useEffect(() => {
    if (!initialLocationAt) return;
    const parsed = new Date(initialLocationAt);
    if (Number.isNaN(parsed.getTime())) return;
    // Never move the "last updated" label backwards because of an older poll.
    setLastUpdated((prev) => (!prev || parsed.getTime() > prev.getTime() ? parsed : prev));
  }, [initialLocationAt]);

  // ======================= SOCKET.IO =======================
  useEffect(() => {
    if (!orderId) return;

    // Default transport order (polling first, then upgrade). Forcing
    // `websocket` first can close the socket mid-handshake in React StrictMode.
    // `autoConnect: false` + a deferred connect avoids opening a socket on the
    // throw-away first mount that StrictMode immediately disconnects. That
    // disconnect is what produced "WebSocket is closed before the connection
    // is established" in the browser console.
    const activeSocket = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: false,
    });
    socket.current = activeSocket;

    const handleSnapshot = (data: TrackingSnapshotPayload) => {
      if (data?.location) {
        applyDriverLocation(
          [data.location.lng, data.location.lat],
          { live: true, at: data.timestamp || null },
        );
      }
      if (data?.status) setStatus(data.status);
      if (data?.eta != null) setEta(data.eta);
      if (data?.distanceRemaining != null) setDistanceRemaining(data.distanceRemaining);
      if (data?.timestamp) {
        const parsed = new Date(data.timestamp);
        if (!Number.isNaN(parsed.getTime())) {
          setLastUpdated((prev) => (!prev || parsed.getTime() > prev.getTime() ? parsed : prev));
        }
      }
    };

    activeSocket.on("connect", () => {
      setIsConnected(true);
      activeSocket.emit("customer:join", { orderId });
    });

    activeSocket.on("disconnect", () => {
      setIsConnected(false);
    });

    // Sent immediately by the server when the customer joins the room.
    activeSocket.on("tracking:snapshot", handleSnapshot);
    activeSocket.on("location:update", handleSnapshot);
    activeSocket.on("order:status", (data: OrderStatusPayload) => {
      if (data?.status) setStatus(data.status);
      if (data?.cancellationReason) setCancellationReason(data.cancellationReason);
    });

    activeSocket.on("connect_error", () => {
      setIsConnected(false);
    });

    activeSocket.on("error", () => {
      // Socket error - the polling fallback in LiveTrackingPage keeps status fresh.
    });

    const connectTimer = setTimeout(() => {
      if (socket.current === activeSocket) activeSocket.connect();
    }, 0);

    return () => {
      clearTimeout(connectTimer);
      activeSocket.removeAllListeners();
      activeSocket.disconnect();
      if (socket.current === activeSocket) {
        socket.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const currentStatus = STATUS_CONFIG[status] || STATUS_CONFIG.preparing;
  const currentStepIndex = STATUS_FLOW.indexOf(status);
  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

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
                {status === "cancelled" && cancellationReason
                  ? cancellationReason
                  : currentStatus.description}
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
          {!driverPosition && (
            <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-500/10 border-t border-amber-100 dark:border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
              {status === "outfordelivery"
                ? "Waiting for the delivery partner's GPS signal…"
                : "The driver's live position will appear here once the order is out for delivery."}
            </div>
          )}
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
            {(restaurantName || restaurantContact) && (
              <div className="flex justify-between gap-4 py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5" />
                  Restaurant
                </span>
                <span className="font-medium text-gray-900 dark:text-white text-right">
                  {restaurantName || "Restaurant"}
                  {restaurantContact ? (
                    <>
                      {" · "}
                      <a
                        href={`tel:${restaurantContact}`}
                        className="text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {restaurantContact}
                      </a>
                    </>
                  ) : null}
                </span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">Last location update</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {updatedLabel || "Waiting for driver GPS"}
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
