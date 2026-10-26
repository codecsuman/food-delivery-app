import axios from "axios";
import {
  calculateDeliveryPricing,
  DELIVERY_PREP_MINUTES,
} from "./deliveryPricing.js";

const OPENCAGE_KEY = process.env.OPENCAGE_API_KEY;
const PINCODE_API_BASE = "https://api.pincodeapi.in/api/v1";
const DELIVERY_SPEED = parseFloat(
  process.env.DELIVERY_SPEED_KM_PER_MIN || "0.333",
);

// Earth's radius in km for Haversine formula
const EARTH_RADIUS_KM = 6371;

// Simple in-memory cache for pincode lookups (TTL: 1 hour)
const pincodeCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface GeocodeResult {
  success: boolean;
  coordinates?: [number, number]; // [longitude, latitude]
  formattedAddress?: string;
  confidence?: number;
  components?: any;
  message?: string;
}

export interface ReverseGeocodeResult {
  success: boolean;
  address?: string;
  components?: any;
  pincode?: string;
  message?: string;
}

export interface PostalRecord {
  id: number | null;
  circle: string | null;
  circle_slug: string | null;
  region: string | null;
  region_slug: string | null;
  division: string | null;
  division_slug: string | null;
  office_name: string;
  office_slug: string | null;
  pincode: string;
  office_type: string | null;
  delivery_status: string | null;
  district: string | null;
  district_slug: string | null;
  state: string | null;
  state_slug: string | null;
  latitude: number | null;
  longitude: number | null;
  digipin: string | null;
}

export interface PincodeLookupResult {
  success: boolean;
  pincode?: string;
  postOffices?: PostalRecord[];
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  message?: string;
}

export interface PincodeValidationResult {
  valid: boolean;
  message: string;
  suggestedAddress?: string;
  suggestedPincode?: string;
  // Auto-fill fields from pincode lookup
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  postOffices?: PostalRecord[];
}

export interface DistanceTimeResult {
  success: boolean;
  distanceKm?: number;
  estimatedMinutes?: number;
  estimatedSeconds?: number;
  estimatedTimeFormatted?: string;
  withinRange?: boolean;
  maxRadius?: number;
  standardRadiusKm?: number;
  chargePerExtraKm?: number;
  baseFee?: number;
  extraDistanceKm?: number;
  extraFee?: number;
  deliveryFee?: number;
  message?: string;
}

export interface DeliveryCheckResult extends DistanceTimeResult {
  deliverable?: boolean;
}

export interface RouteResult {
  success: boolean;
  distanceKm?: number;
  estimatedMinutes?: number;
  estimatedTimeFormatted?: string;
  routeCoordinates?: [number, number][]; // [lng, lat][]
  message?: string;
}

class MapService {
  // ========== GEOCODING: Address → Coordinates (OpenCage) ==========
  async geocodeAddress(
    address: string,
    pincode: string,
  ): Promise<GeocodeResult> {
    try {
      const fullAddress = `${address}, ${pincode}, India`;
      const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(fullAddress)}&key=${OPENCAGE_KEY}&limit=1&countrycode=in`;

      const res = await axios.get(url);

      if (res.data.results && res.data.results.length > 0) {
        const result = res.data.results[0];
        return {
          success: true,
          coordinates: [result.geometry.lng, result.geometry.lat], // [longitude, latitude]
          formattedAddress: result.formatted,
          confidence: result.confidence,
          components: result.components,
        };
      }

      return { success: false, message: "Address not found" };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // ========== REVERSE GEOCODING: Coordinates → Address (OpenCage) ==========
  async reverseGeocode(
    lng: number,
    lat: number,
  ): Promise<ReverseGeocodeResult> {
    try {
      const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${OPENCAGE_KEY}&limit=1`;
      const res = await axios.get(url);

      if (res.data.results && res.data.results.length > 0) {
        const result = res.data.results[0];
        return {
          success: true,
          address: result.formatted,
          components: result.components,
          pincode: result.components.postcode,
        };
      }
      return { success: false, message: "Location not found" };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // ========== PINCODE LOOKUP (Pincode API - Free, No Key Required) ==========
  async lookupPincode(pincode: string): Promise<PincodeLookupResult> {
    // Validate format
    if (!/^\d{6}$/.test(pincode)) {
      return { success: false, message: "Pincode must be 6 digits" };
    }

    // Check cache first
    const cached = pincodeCache.get(pincode);
    if (cached && cached.expiry > Date.now()) {
      return { success: true, ...cached.data };
    }

    try {
      const url = `${PINCODE_API_BASE}/pincode/${pincode}`;
      const res = await axios.get(url, {
        timeout: 5000,
        headers: { "Accept": "application/json" }
      });

      if (res.data.success && res.data.data?.post_offices?.length > 0) {
        const postOffices: PostalRecord[] = res.data.data.post_offices;
        const firstOffice = postOffices[0];

        // Extract unique city, district, state from all post offices
        const cities = [...new Set(postOffices.map(o => o.district).filter(Boolean))];
        const districts = [...new Set(postOffices.map(o => o.district).filter(Boolean))];
        const states = [...new Set(postOffices.map(o => o.state).filter(Boolean))];

        // Prefer the first office's data, but collect all unique values
        const result = {
          success: true,
          pincode,
          postOffices,
          city: firstOffice.district || cities[0] || "", // district often serves as city
          district: firstOffice.district || districts[0] || "",
          state: firstOffice.state || states[0] || "",
          country: "India",
          latitude: firstOffice.latitude ?? undefined,
          longitude: firstOffice.longitude ?? undefined,
        };

        // Cache the result
        pincodeCache.set(pincode, { data: result, expiry: Date.now() + CACHE_TTL_MS });

        return result;
      }

      return { success: false, message: "Pincode not found" };
    } catch (error: any) {
      // Handle rate limiting (429) gracefully
      if (error.response?.status === 429) {
        return { success: false, message: "Rate limit reached. Please try again in a few seconds." };
      }
      return { success: false, message: error.message || "Failed to lookup pincode" };
    }
  }

  // ========== PINCODE VALIDATION WITH AUTO-FILL ==========
  async validatePincode(
    pincode: string,
    coordinates?: [number, number],
  ): Promise<PincodeValidationResult> {
    // 1. Basic format validation
    if (!/^\d{6}$/.test(pincode)) {
      return { valid: false, message: "Pincode must be 6 digits" };
    }

    // 2. Lookup pincode via Pincode API (free, no key)
    const pincodeData = await this.lookupPincode(pincode);
    
    if (!pincodeData.success) {
      // The pincode API is a third-party service and is frequently rate
      // limited/unavailable. A valid 6-digit format must not be rejected just
      // because that service is down. If a pin/GPS position exists, verify
      // against it (as a warning); otherwise accept the format and let the
      // address geocoder/server validation decide.
      if (coordinates) {
        return this.validatePincodeWithCoordinates(pincode, coordinates);
      }
      return {
        valid: true,
        message: `Pincode ${pincode} has a valid format, but it could not be verified online right now.`,
      };
    }

    // 3. If coordinates provided, verify they match the pincode area
    if (coordinates && pincodeData.latitude && pincodeData.longitude) {
      const distance = this.calculateDistanceKm(
        coordinates,
        [pincodeData.longitude, pincodeData.latitude]
      );
      
      // Allow ~15km tolerance for pincode area (pincodes cover large areas)
      if (distance > 15) {
        return {
          valid: true, // Still allow but warn
          message: `Pincode ${pincode} is valid but the selected location is ${distance.toFixed(1)}km from the pincode center. Please confirm the address.`,
          suggestedPincode: pincode,
          city: pincodeData.city,
          district: pincodeData.district,
          state: pincodeData.state,
          country: pincodeData.country,
          postOffices: pincodeData.postOffices,
        };
      }
    }

    // 4. Success - return auto-fill data
    return {
      valid: true,
      message: "Pincode verified",
      city: pincodeData.city,
      district: pincodeData.district,
      state: pincodeData.state,
      country: pincodeData.country,
      postOffices: pincodeData.postOffices,
    };
  }

  // Fallback validation using coordinates + OpenCage reverse geocode
  private async validatePincodeWithCoordinates(
    pincode: string,
    coordinates: [number, number],
  ): Promise<PincodeValidationResult> {
    const reverse = await this.reverseGeocode(coordinates[0], coordinates[1]);
    if (!reverse.success) {
      return {
        valid: true,
        message: `Pincode ${pincode} has a valid format. The online address lookup is unavailable right now, so your selected map position will be used.`,
      };
    }

    const foundPincode = reverse.pincode || reverse.components?.postcode;
    
    if (foundPincode && foundPincode !== pincode) {
      return {
        valid: true,
        message: `Pincode ${pincode} differs from the pincode detected at this location (${foundPincode}). Please review the address before continuing.`,
        suggestedAddress: reverse.address,
        suggestedPincode: foundPincode,
      };
    }

    return { valid: true, message: "Pincode verified" };
  }

  // ========== HAVERSINE FORMULA: Calculate distance between two coordinates ==========
  calculateDistanceKm(
    coord1: [number, number],
    coord2: [number, number],
  ): number {
    // coord format: [longitude, latitude]
    const [lon1, lat1] = coord1;
    const [lon2, lat2] = coord2;

    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = EARTH_RADIUS_KM * c;

    return parseFloat(distance.toFixed(2));
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // ========== DISTANCE & TIME CALCULATION (FREE - No API needed!) ==========
  async getDistanceAndTime(
    origin: [number, number],
    destination: [number, number],
  ): Promise<DistanceTimeResult> {
    const distanceKm = this.calculateDistanceKm(origin, destination);

    // YOUR RULE: 1km = 3 minutes
    const estimatedMinutes = Math.ceil(distanceKm / DELIVERY_SPEED);
    const pricing = calculateDeliveryPricing(distanceKm);

    return {
      success: true,
      distanceKm: pricing.distanceKm,
      estimatedMinutes,
      estimatedSeconds: estimatedMinutes * 60,
      estimatedTimeFormatted: this.formatTime(estimatedMinutes),
      withinRange: pricing.withinRange,
      maxRadius: pricing.maxRadius,
      standardRadiusKm: pricing.standardRadiusKm,
      chargePerExtraKm: pricing.chargePerExtraKm,
      baseFee: pricing.baseFee,
      extraDistanceKm: pricing.extraDistanceKm,
      extraFee: pricing.extraFee,
      deliveryFee: pricing.deliveryFee,
    };
  }

  // ========== DELIVERY TIME CALCULATOR ==========
  calculateDeliveryTime(distanceKm: number): {
    minutes: number;
    formatted: string;
    distanceKm: number;
  } {
    const minutes = Math.ceil(distanceKm / DELIVERY_SPEED);
    return {
      minutes,
      formatted: this.formatTime(minutes),
      distanceKm,
    };
  }

  // ========== CHECK DELIVERY RANGE ==========
  async checkDeliveryRange(
    restaurantCoords: [number, number],
    customerCoords: [number, number],
    baseFee = 0,
    minimumMinutes = 0,
  ): Promise<DeliveryCheckResult> {
    const result = await this.getDistanceAndTime(
      restaurantCoords,
      customerCoords,
    );
    if (!result.success) return result;

    const pricing = calculateDeliveryPricing(result.distanceKm || 0, baseFee);
    // Travel time plus a small preparation allowance, but never less than the
    // restaurant's own estimate.
    const estimatedMinutes = Math.max(
      (result.estimatedMinutes || 0) + DELIVERY_PREP_MINUTES,
      minimumMinutes,
    );
    const estimatedTimeFormatted = this.formatTime(estimatedMinutes);

    return {
      ...result,
      ...pricing,
      estimatedMinutes,
      estimatedSeconds: estimatedMinutes * 60,
      estimatedTimeFormatted,
      deliverable: pricing.withinRange,
      message: pricing.withinRange
        ? `We deliver! Estimated time: ${estimatedTimeFormatted}. Delivery fee: ₹${pricing.deliveryFee}${
            pricing.extraFee > 0
              ? ` (includes ₹${pricing.extraFee} for ${pricing.extraDistanceKm} km beyond ${pricing.standardRadiusKm} km)`
              : ""
          }`
        : `Sorry, we only deliver within ${pricing.maxRadius} km. You're ${pricing.distanceKm} km away.`,
    };
  }

  // ========== GET ROUTE COORDINATES FOR LIVE TRACKING ==========
  // Note: This returns straight-line coordinates. For actual road routes,
  // integrate OSRM (free, self-hosted) or Mapbox Directions API later.
  getRouteCoordinates(
    start: [number, number],
    end: [number, number],
  ): [number, number][] {
    // Generate intermediate points for drawing a route line
    const points: [number, number][] = [];
    const steps = 20;

    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps;
      const lng = start[0] + (end[0] - start[0]) * ratio;
      const lat = start[1] + (end[1] - start[1]) * ratio;
      points.push([lng, lat]);
    }

    return points;
  }

  // ========== FORMAT TIME HELPER ==========
  private formatTime(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }
}

export default new MapService();