import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Loader2, MapPin, Check, LocateFixed } from "lucide-react";
import { lookupPincode } from "@/lib/pincode";
import { API_BASE_URL } from "@/lib/api";

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

const DEFAULT_CENTER: [number, number] = [22.5726, 88.3639]; // [lat, lng]

const isValidCoords = (coords?: readonly number[] | null): coords is [number, number] => {
  if (!coords || coords.length < 2) return false;
  const [lng, lat] = coords;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return false;
  return !(lng === 0 && lat === 0);
};

interface AddressPickerProps {
  onAddressSelect: (data: {
    address: string;
    pincode: string;
    coordinates: [number, number]; // [lng, lat]
    formattedAddress: string;
    city?: string;
    state?: string;
    country?: string;
  }) => void;
  initialAddress?: string;
  initialPincode?: string;
  /** Previously selected/saved position, [lng, lat]. */
  initialCoordinates?: [number, number];
}

const AddressPicker = ({
  onAddressSelect,
  initialAddress = "",
  initialPincode = "",
  initialCoordinates,
}: AddressPickerProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLookupAttempted = useRef(false);
  // Only the newest async lookup may update the form. Without these guards an
  // older reverse-geocode/pincode/autocomplete response could overwrite a
  // newer pin or typed value with stale data.
  const reverseRequestId = useRef(0);
  const pincodeRequestId = useRef(0);
  const autocompleteRequestId = useRef(0);
  const initialLookupRequestId = useRef(0);

  const [address, setAddress] = useState(initialAddress);
  const [pincode, setPincode] = useState(initialPincode);
  // [lng, lat] — the exact pin the customer chose. This is what gets sent to
  // the server; it is no longer discarded in favour of a text geocode.
  const [coordinates, setCoordinates] = useState<[number, number] | null>(
    isValidCoords(initialCoordinates) ? initialCoordinates : null,
  );
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [validated, setValidated] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  // City/state/country returned by reverse-geocoding the current pin. Used as
  // the fallback when the pincode lookup cannot verify the postcode, so the
  // parent form still receives consistent location data.
  const [reversedLocation, setReversedLocation] = useState<{
    city?: string;
    state?: string;
    country?: string;
  }>({});
  const [pincodeData, setPincodeData] = useState<{
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    postOffices?: any[];
  } | null>(null);

  // BUG FIX: the parent can pass a profile address/pincode after this
  // component mounts, but the state was only initialized once. Sync the
  // initial values without overwriting anything the user already typed.
  useEffect(() => {
    if (initialAddress) {
      setAddress((current) => current || initialAddress);
    }
    if (initialPincode) {
      setPincode((current) => current || initialPincode);
    }
  }, [initialAddress, initialPincode]);

  const extractPincode = (addr: string) => {
    const match = addr.match(/\b\d{6}\b/);
    return match ? match[0] : "";
  };

  const applyReverseGeocode = (data: any) => {
    if (!data?.success) return;

    if (data.address) {
      setAddress(data.address);
    }

    const components = data.components || {};
    const foundPincode =
      data.pincode ||
      components.postcode ||
      (data.address ? extractPincode(data.address) : "");
    // This pin is the new source of truth. If the reverse geocoder has no
    // postcode for it, clear the old value rather than leaving a stale
    // pincode from a previous location attached to the new GPS/map position.
    setPincode(foundPincode || "");
    setReversedLocation({
      city:
        components.city ||
        components.town ||
        components.village ||
        components.municipality ||
        components.county ||
        "",
      state: components.state || "",
      country: components.country || "",
    });

    // The map position is now the source of truth. Drop any city/state box
    // that was filled from a previously typed pincode so it cannot display
    // stale information for the new pin.
    setPincodeData(null);
    setValidated(false);
    setWarning("");
    setError("");
  };

  const reverseGeocodeAt = async (lat: number, lng: number) => {
    const requestId = ++reverseRequestId.current;
    try {
      const res = await fetch(`${API_BASE_URL}/map/reverse-geocode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lng, lat }),
      });
      const data = await res.json();
      if (requestId === reverseRequestId.current) applyReverseGeocode(data);
    } catch {
      // Reverse geocode error - the pin is still usable, the customer can type
      // the address manually.
    }
  };

  const placeMarker = (
    coords: [number, number], // [lat, lng] (Leaflet order)
    options: { recenter?: boolean } = {},
  ) => {
    if (!map.current) return;

    if (marker.current) {
      marker.current.setLatLng(coords);
    } else {
      marker.current = L.marker(coords, { draggable: true }).addTo(map.current);
      marker.current.on("dragend", () => {
        if (!marker.current) return;
        const position = marker.current.getLatLng();
        setCoordinates([position.lng, position.lat]);
        setValidated(false);
        void reverseGeocodeAt(position.lat, position.lng);
      });
    }

    setCoordinates([coords[1], coords[0]]);
    if (options.recenter !== false) {
      map.current.setView(coords, 15);
    }
  };

  const handleMapPick = (lat: number, lng: number) => {
    initialLookupRequestId.current += 1;
    pincodeRequestId.current += 1;
    setPincodeLoading(false);
    placeMarker([lat, lng]);
    setValidated(false);
    void reverseGeocodeAt(lat, lng);
  };

  // Initialize OpenStreetMap
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    const startLat = isValidCoords(initialCoordinates) ? initialCoordinates[1] : DEFAULT_CENTER[0];
    const startLng = isValidCoords(initialCoordinates) ? initialCoordinates[0] : DEFAULT_CENTER[1];
    const instance = L.map(mapContainer.current).setView(
      [startLat, startLng],
      isValidCoords(initialCoordinates) ? 15 : 12,
    );
    map.current = instance;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(instance);

    // Click on map to set location
    instance.on("click", (e: L.LeafletMouseEvent) => {
      handleMapPick(e.latlng.lat, e.latlng.lng);
    });

    // BUG FIX: the Leaflet instance was never destroyed. On route changes this
    // leaked the map, tile handlers and DOM listeners ("Map container is
    // already initialized" errors on remount / React StrictMode).
    return () => {
      if (autocompleteTimer.current) {
        clearTimeout(autocompleteTimer.current);
        autocompleteTimer.current = null;
      }
      instance.remove();
      map.current = null;
      marker.current = null;
      // React StrictMode mounts, cleans up, then mounts again. Allow the
      // initial address lookup to run for the recreated map (the first
      // request is cancelled by its own effect cleanup).
      initialLookupAttempted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show the previously chosen pin immediately when opening the picker again.
  useEffect(() => {
    if (!map.current || !isValidCoords(initialCoordinates)) return;
    placeMarker([initialCoordinates[1], initialCoordinates[0]]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCoordinates?.[0], initialCoordinates?.[1]]);

  // When no pin was saved yet, geocode the saved address once so the map opens
  // at the customer's actual location instead of the hard-coded fallback.
  useEffect(() => {
    if (initialLookupAttempted.current) return;
    if (isValidCoords(initialCoordinates)) {
      initialLookupAttempted.current = true;
      return;
    }
    if (!map.current || !initialAddress || initialPincode.length !== 6) return;

    initialLookupAttempted.current = true;
    let active = true;
    const requestId = ++initialLookupRequestId.current;

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/map/validate-address`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ address: initialAddress, pincode: initialPincode }),
        });
        const data = await res.json();
        if (
          !active ||
          requestId !== initialLookupRequestId.current ||
          !data.success ||
          !isValidCoords(data.coordinates)
        ) {
          return;
        }

        placeMarker([data.coordinates[1], data.coordinates[0]]);
        setPincodeData({
          city: data.city,
          district: data.district,
          state: data.state,
          country: data.country,
          postOffices: data.postOffices,
        });
      } catch {
        // The customer can still click/drag the pin manually.
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAddress, initialPincode, initialCoordinates?.[0], initialCoordinates?.[1]]);

  // Auto-fill city, district, state when pincode is entered (6 digits)
  const handlePincodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const requestId = ++pincodeRequestId.current;
    // A manual pincode edit invalidates a pending map reverse-geocode response
    // and the one-time initial address lookup.
    reverseRequestId.current += 1;
    initialLookupRequestId.current += 1;
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setPincode(value);
    setValidated(false);
    setWarning("");
    setPincodeData(null);

    if (value.length === 6) {
      setPincodeLoading(true);
      try {
        const data = await lookupPincode(value);
        if (requestId === pincodeRequestId.current && data?.success) {
          setPincodeData({
            city: data.city,
            district: data.district,
            state: data.state,
            country: data.country,
            postOffices: data.postOffices,
          });
        }
      } finally {
        if (requestId === pincodeRequestId.current) setPincodeLoading(false);
      }
    } else {
      setPincodeLoading(false);
    }
  };

  // Use device GPS to fetch current location
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      return;
    }

    initialLookupRequestId.current += 1;
    pincodeRequestId.current += 1;
    setPincodeLoading(false);
    setLocating(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        // Place the pin immediately with the device's exact GPS position.
        placeMarker([latitude, longitude]);
        setValidated(false);
        await reverseGeocodeAt(latitude, longitude);
        setLocating(false);
      },
      (err) => {
        setError(err.code === 1
          ? "Location permission denied. Please enable in browser settings."
          : "Could not fetch location. Try again.");
        setLocating(false);
      },
      // maximumAge: 0 prevents the browser from reusing a stale cached fix.
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  // Address autocomplete using backend proxy (keeps API key secure)
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAddress(value);
    setValidated(false);
    // The customer is typing a new address; ignore any in-flight reverse
    // geocode or initial lookup that would overwrite it.
    reverseRequestId.current += 1;
    initialLookupRequestId.current += 1;

    // Debounce requests so typing doesn't fire one API call per keystroke.
    if (autocompleteTimer.current) {
      clearTimeout(autocompleteTimer.current);
      autocompleteTimer.current = null;
    }

    if (value.length <= 3) {
      autocompleteRequestId.current += 1;
      setSuggestions([]);
      return;
    }

    autocompleteTimer.current = setTimeout(async () => {
      const requestId = ++autocompleteRequestId.current;
      try {
        const res = await fetch(`${API_BASE_URL}/map/autocomplete?q=${encodeURIComponent(value)}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        const data = await res.json();
        if (requestId === autocompleteRequestId.current) {
          setSuggestions(data.success ? data.suggestions || [] : []);
        }
      } catch {
        if (requestId === autocompleteRequestId.current) setSuggestions([]);
      }
    }, 300);
  };

  const selectSuggestion = (result: any) => {
    if (autocompleteTimer.current) {
      clearTimeout(autocompleteTimer.current);
      autocompleteTimer.current = null;
    }
    reverseRequestId.current += 1;
    autocompleteRequestId.current += 1;
    initialLookupRequestId.current += 1;
    pincodeRequestId.current += 1;
    setPincodeLoading(false);
    setAddress(result.formatted);
    const resultCoords: [number, number] = result.coordinates || [result.geometry?.lng, result.geometry?.lat];
    if (isValidCoords(resultCoords)) {
      placeMarker([resultCoords[1], resultCoords[0]]); // Leaflet uses [lat, lng]
    } else {
      setCoordinates(null);
    }
    const pickedPincode = result.components?.postcode || extractPincode(result.formatted);
    if (pickedPincode) setPincode(pickedPincode);
    setReversedLocation({
      city:
        result.components?.city ||
        result.components?.town ||
        result.components?.village ||
        result.components?.municipality ||
        result.components?.county ||
        "",
      state: result.components?.state || "",
      country: result.components?.country || "",
    });
    setPincodeData(null);
    setSuggestions([]);
    setValidated(false);
    setWarning("");
    setError("");
  };

  // Validate & Submit
  const handleSubmit = async () => {
    if (!address || pincode.length !== 6) {
      setError("Please enter a valid address and 6-digit pincode");
      return;
    }

    setLoading(true);
    setError("");
    setWarning("");

    try {
      const payload: Record<string, unknown> = { address, pincode };
      if (coordinates) {
        // Send the exact marker/GPS position. The backend treats this as the
        // source of truth and only uses geocoding for the formatted address.
        payload.lat = coordinates[1];
        payload.lng = coordinates[0];
      }

      const validateRes = await fetch(`${API_BASE_URL}/map/validate-address`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const validateData = await validateRes.json();

      if (!validateData.success) {
        setError(validateData.message);
        setLoading(false);
        return;
      }

      // A valid 6-digit pincode is never rejected because a third-party lookup
      // says it cannot confirm it. `pincodeValid === false` is reserved for a
      // malformed pincode, which the format check above already prevents.
      if (validateData.pincodeValid === false) {
        setError(validateData.pincodeMessage || "Please check the pincode and try again.");
        setLoading(false);
        return;
      }

      // Non-blocking review note (e.g. the detected pincode differs from the
      // typed one). The customer stays in control and can correct the field.
      if (validateData.pincodeMessage && validateData.pincodeMessage !== "Pincode verified") {
        setWarning(validateData.pincodeMessage);
      }
      if (validateData.suggestedPincode && validateData.suggestedPincode !== pincode) {
        console.warn(`Pincode warning: ${validateData.pincodeMessage}`);
      }

      const chosenCoordinates: [number, number] = isValidCoords(validateData.coordinates)
        ? [validateData.coordinates[0], validateData.coordinates[1]]
        : (coordinates as [number, number]);

      if (!isValidCoords(chosenCoordinates)) {
        setError("Could not determine the selected location. Please drop a pin on the map.");
        setLoading(false);
        return;
      }

      setCoordinates(chosenCoordinates);
      placeMarker([chosenCoordinates[1], chosenCoordinates[0]], { recenter: false });
      setValidated(true);
      setAddress(validateData.formattedAddress || address);

      onAddressSelect({
        address: validateData.formattedAddress || address,
        pincode,
        coordinates: chosenCoordinates,
        formattedAddress: validateData.formattedAddress || address,
        city: validateData.city || reversedLocation.city,
        state: validateData.state || reversedLocation.state,
        country: validateData.country || reversedLocation.country,
      });
    } catch {
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
        <div className="flex items-center justify-between">
          <Label className="text-gray-700 dark:text-gray-300 font-medium mb-2 block">Pincode</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={useCurrentLocation}
            disabled={loading || locating}
            className="h-9 text-xs gap-1"
          >
            {locating ? (
              <>
                <Loader2 className="mr-2 w-3.5 h-3.5 animate-spin" />
                Locating...
              </>
            ) : (
              <>
                <LocateFixed className="mr-2 w-3.5 h-3.5 text-orange-500" />
                Use My Location
              </>
            )}
          </Button>
        </div>
        <Input
          type="text"
          value={pincode}
          onChange={handlePincodeChange}
          placeholder="6-digit pincode (auto-fills city/state)"
          maxLength={6}
          className="h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500"
        />

        {/* Auto-filled location info from pincode */}
        {pincodeData && (
          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg animate-fade-in">
            <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Auto-filled from pincode:</p>
            <div className="grid grid-cols-2 gap-2 mt-1 text-sm">
              <span className="text-gray-600 dark:text-gray-400">City/District: <span className="font-medium text-gray-900 dark:text-white">{pincodeData.city || pincodeData.district || "-"}</span></span>
              <span className="text-gray-600 dark:text-gray-400">State: <span className="font-medium text-gray-900 dark:text-white">{pincodeData.state || "-"}</span></span>
              <span className="text-gray-600 dark:text-gray-400">Country: <span className="font-medium text-gray-900 dark:text-white">{pincodeData.country || "-"}</span></span>
              <span className="text-gray-600 dark:text-gray-400">Post Offices: <span className="font-medium text-gray-900 dark:text-white">{pincodeData.postOffices?.length || 0}</span></span>
            </div>
          </div>
        )}

        {pincodeLoading && (
          <div className="mt-2 flex items-center gap-2 text-xs text-orange-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Looking up pincode...
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {warning && !error && (
        <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg px-3 py-2">
          {warning} You can correct the address or pincode above, then validate again.
        </p>
      )}

      {validated && (
        <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 dark:bg-green-500/10 px-3 py-2 rounded-lg">
          <Check className="w-4 h-4" />
          Address validated successfully!
        </div>
      )}

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={loading || locating || !address || pincode.length !== 6}
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
      <p className="text-xs text-gray-400 dark:text-gray-500 -mt-1">
        Click the map or drag the pin to select your exact delivery point.
      </p>
    </div>
  );
};

export default AddressPicker;
