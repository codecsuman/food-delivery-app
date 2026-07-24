import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Loader2, MapPin, Check } from "lucide-react";

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

interface AddressPickerProps {
  onAddressSelect: (data: {
    address: string;
    pincode: string;
    coordinates: [number, number];
    formattedAddress: string;
  }) => void;
  initialAddress?: string;
  initialPincode?: string;
}

const AddressPicker = ({ onAddressSelect, initialAddress = "", initialPincode = "" }: AddressPickerProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);

  const [address, setAddress] = useState(initialAddress);
  const [pincode, setPincode] = useState(initialPincode);
const [, setCoordinates] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [validated, setValidated] = useState(false);

  // Initialize OpenStreetMap
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = L.map(mapContainer.current).setView([22.5726, 88.3639], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map.current);

    // Click on map to set location
    map.current.on("click", async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setCoordinates([lng, lat]);
      placeMarker([lat, lng]);

      // Reverse geocode — FIXED: added credentials: 'include'
      try {
        const res = await fetch("/api/v1/map/reverse-geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ lng, lat }),
        });
        const data = await res.json();
        if (data.success) {
          setAddress(data.address);
          extractPincode(data.address);
          setValidated(false);
        }
      } catch (err) {
        console.error(err);
      }
    });
  }, []);

  const placeMarker = (coords: [number, number]) => {
    if (!map.current) return;
    if (marker.current) map.current.removeLayer(marker.current);
    marker.current = L.marker(coords).addTo(map.current);
    map.current.setView(coords, 15);
  };

  const extractPincode = (addr: string) => {
    const match = addr.match(/\b\d{6}\b/);
    if (match) setPincode(match[0]);
  };

  // Address autocomplete using OpenCage
  const handleAddressChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAddress(value);
    setValidated(false);

    if (value.length > 3) {
      try {
        const res = await fetch(
          `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(value + ", India")}&key=${import.meta.env.VITE_OPENCAGE_KEY}&limit=5&countrycode=in`
        );
        const data = await res.json();
        setSuggestions(data.results || []);
      } catch (err) {
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  };

  const selectSuggestion = (result: any) => {
    setAddress(result.formatted);
    const coords: [number, number] = [result.geometry.lng, result.geometry.lat];
    setCoordinates(coords);
    placeMarker([result.geometry.lat, result.geometry.lng]);
    extractPincode(result.formatted);
    setSuggestions([]);
    setValidated(false);
  };

  // Validate & Submit
  const handleSubmit = async () => {
    if (!address || pincode.length !== 6) {
      setError("Please enter a valid address and 6-digit pincode");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // FIXED: added credentials: 'include'
      const validateRes = await fetch("/api/v1/map/validate-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address, pincode }),
      });
      const validateData = await validateRes.json();

      if (!validateData.success) {
        setError(validateData.message);
        setLoading(false);
        return;
      }

      if (!validateData.pincodeValid) {
        setError(`Pincode mismatch! ${validateData.pincodeMessage}`);
        setLoading(false);
        return;
      }

      setCoordinates(validateData.coordinates);
      setValidated(true);
      setAddress(validateData.formattedAddress);

      onAddressSelect({
        address: validateData.formattedAddress,
        pincode,
        coordinates: validateData.coordinates,
        formattedAddress: validateData.formattedAddress,
      });
    } catch (err) {
      setError("Failed to validate address. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Address Input */}
      <div className="relative">
        <Label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium mb-2">
          <MapPin className="w-4 h-4 text-orange-500" />
          Delivery Address
        </Label>
        <Input
          type="text"
          value={address}
          onChange={handleAddressChange}
          placeholder="Enter your full address..."
          className="h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500"
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-50 top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
            {suggestions.map((s, i) => (
              <li
                key={i}
                onClick={() => selectSuggestion(s)}
                className="px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-gray-700 hover:bg-orange-50 dark:hover:bg-orange-500/10 text-sm text-gray-700 dark:text-gray-300"
              >
                {s.formatted}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pincode Input */}
      <div>
        <Label className="text-gray-700 dark:text-gray-300 font-medium mb-2 block">Pincode</Label>
        <Input
          type="text"
          value={pincode}
          onChange={(e) => {
            setPincode(e.target.value.replace(/\D/g, "").slice(0, 6));
            setValidated(false);
          }}
          placeholder="6-digit pincode"
          maxLength={6}
          className="h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {validated && (
        <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 dark:bg-green-500/10 px-3 py-2 rounded-lg">
          <Check className="w-4 h-4" />
          Address validated successfully!
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={loading || !address || pincode.length !== 6}
        className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-lg shadow-md shadow-orange-500/20 disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 w-4 h-4 animate-spin" />
            Validating...
          </>
        ) : validated ? (
          <>
            <Check className="mr-2 w-4 h-4" />
            Address Confirmed
          </>
        ) : (
          "Validate Address"
        )}
      </Button>

      {/* Map */}
      <div
        ref={mapContainer}
        className="w-full h-64 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      />
    </div>
  );
};

export default AddressPicker;