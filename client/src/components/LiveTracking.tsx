import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { io, Socket } from "socket.io-client";
import { Truck, Clock, MapPin, Navigation } from "lucide-react";

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
  restaurantCoords: [number, number]; // [lng, lat]
  customerCoords: [number, number];   // [lng, lat]
  initialDriverCoords?: [number, number]; // [lng, lat]
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:8001";

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

  // FIX: Prefix unused variable with underscore
  const [_driverLocation, setDriverLocation] = useState<[number, number]>(initialDriverCoords);
  const [eta, setEta] = useState<number | null>(null);
  const [distanceRemaining, setDistanceRemaining] = useState<number | null>(null);
  const [status, setStatus] = useState("preparing");

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize map
    map.current = L.map(mapContainer.current).setView(
      [customerCoords[1], customerCoords[0]],
      13
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map.current);

    // Restaurant marker (orange)
    L.marker([restaurantCoords[1], restaurantCoords[0]], {
      icon: L.divIcon({
        className: "restaurant-marker",
        html: '<div style="font-size:24px;">🏪</div>',
        iconSize: [30, 30],
      }),
    })
      .addTo(map.current)
      .bindPopup("Restaurant");

    // Customer marker (green)
    L.marker([customerCoords[1], customerCoords[0]], {
      icon: L.divIcon({
        className: "customer-marker",
        html: '<div style="font-size:24px;">🏠</div>',
        iconSize: [30, 30],
      }),
    })
      .addTo(map.current)
      .bindPopup("Your Location");

    // Driver marker (red scooter)
    driverMarker.current = L.marker([initialDriverCoords[1], initialDriverCoords[0]], {
      icon: L.divIcon({
        className: "driver-marker",
        html: '<div style="font-size:24px;">🛵</div>',
        iconSize: [30, 30],
      }),
    }).addTo(map.current).bindPopup("Driver");

    // Draw initial route
    drawRoute(initialDriverCoords, customerCoords);

    // Connect WebSocket
    socket.current = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });
    
    socket.current.emit("customer:join", { orderId });

    socket.current.on("location:update", (data: any) => {
      setDriverLocation(data.location);
      setEta(data.eta);
      setDistanceRemaining(data.distanceRemaining);
      setStatus(data.status);

      if (driverMarker.current && map.current) {
        driverMarker.current.setLatLng([data.location.lat, data.location.lng]);
        drawRoute([data.location.lng, data.location.lat], customerCoords);
      }
    });

    socket.current.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
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
        headers: {
          "Content-Type": "application/json",
        },
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
          color: "#e63946",
          weight: 4,
          opacity: 0.8,
          dashArray: "10, 10",
        }).addTo(map.current);

        map.current.fitBounds(routeLine.current.getBounds(), { padding: [50, 50] });
      }
    } catch (err) {
      console.error("Route error:", err);
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "preparing": return "Restaurant is preparing your food";
      case "picked_up": return "Driver picked up your order";
      case "delivering": return "Driver is on the way";
      case "delivered": return "Delivered!";
      default: return "Processing...";
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "delivered": return "bg-green-500";
      case "delivering": return "bg-blue-500";
      case "picked_up": return "bg-orange-500";
      default: return "bg-yellow-500";
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gray-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="w-5 h-5" />
          <h3 className="font-semibold">Live Order Tracking</h3>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor()}`}>
          {getStatusText()}
        </div>
      </div>

      {/* ETA Card */}
      <div className="p-6 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/10 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <div className="text-4xl font-extrabold text-orange-600 dark:text-orange-400">
              {eta !== null ? `${eta}` : "--"}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">min remaining</div>
          </div>
          <div className="w-px h-12 bg-gray-200 dark:bg-gray-700" />
          <div className="text-center flex-1">
            <div className="text-4xl font-extrabold text-orange-600 dark:text-orange-400">
              {distanceRemaining !== null ? `${distanceRemaining.toFixed(1)}` : "--"}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">km away</div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          Based on 1 km = 3 min delivery speed
        </div>
      </div>

      {/* Map */}
      <div ref={mapContainer} className="h-80 w-full" />

      {/* Info */}
      <div className="p-4 bg-gray-50 dark:bg-gray-700/30 flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <MapPin className="w-4 h-4 text-orange-500" />
          <span>Order #{orderId.slice(-8).toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <Navigation className="w-4 h-4 text-orange-500" />
          <span>Live tracking active</span>
        </div>
      </div>
    </div>
  );
};

export default LiveTracking;