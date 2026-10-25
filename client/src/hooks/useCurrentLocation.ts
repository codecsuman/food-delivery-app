import { useState, useCallback } from "react";

interface LocationData {
  address: string;
  city: string;
  country: string;
  pincode: string;
  coordinates: [number, number]; // [lng, lat]
  formattedAddress: string;
  state?: string;
  district?: string;
}

interface UseCurrentLocationReturn {
  fetchLocation: () => Promise<LocationData | null>;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch current location and reverse geocode to get city, pincode, etc.
 * Uses your existing OpenCage API via /api/v1/map/reverse-geocode
 * 
 * Usage:
 *   const { fetchLocation, loading, error } = useCurrentLocation();
 *   
 *   const handleClick = async () => {
 *     const location = await fetchLocation();
 *     if (location) {
 *       // location.city, location.pincode, location.country, etc.
 *     }
 *   };
 */
export const useCurrentLocation = (): UseCurrentLocationReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  const fetchLocation = useCallback(async (): Promise<LocationData | null> => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Get GPS coordinates from browser
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;

      // 2. Reverse geocode using YOUR existing API (OpenCage)
      const res = await fetch(`${API_BASE_URL}/map/reverse-geocode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lng: longitude, lat: latitude }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to get location details");
      }

      // 3. Extract structured data from OpenCage response
      const components = data.components || {};
      const address = data.address || "";

      // OpenCage returns these component fields:
      // city, town, village, municipality, county, state, country, postcode
      const city = 
        components.city || 
        components.town || 
        components.village || 
        components.municipality || 
        components.county || 
        "";

      const country = components.country || "India";
      const pincode = components.postcode || "";
      const state = components.state || "";
      const district = components.county || components.state_district || "";

      // Fallback: extract pincode from address string if not in components
      const pincodeFromAddress = address.match(/\b\d{6}\b/);
      const finalPincode = pincode || (pincodeFromAddress ? pincodeFromAddress[0] : "");

      // Fallback: extract city from address parts
      let finalCity = city;
      if (!finalCity) {
        const parts = address.split(",").map((p: string) => p.trim());
        // Usually city is 3rd from end: "Area, City, State, Country"
        if (parts.length >= 3) {
          finalCity = parts[parts.length - 3];
        }
      }

      return {
        address,
        city: finalCity,
        country,
        pincode: finalPincode,
        coordinates: [longitude, latitude],
        formattedAddress: address,
        state,
        district,
      };
    } catch (err: any) {
      const message = 
        err.code === err.PERMISSION_DENIED
          ? "Location permission denied. Please enable in browser settings."
          : err.message || "Could not fetch location. Please try again.";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { fetchLocation, loading, error };
};

export default useCurrentLocation;