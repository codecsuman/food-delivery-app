import axios from "axios";

const OPENCAGE_KEY = process.env.OPENCAGE_API_KEY;
const DELIVERY_SPEED = parseFloat(
  process.env.DELIVERY_SPEED_KM_PER_MIN || "0.333",
);
const MAX_RADIUS = parseFloat(process.env.MAX_DELIVERY_RADIUS_KM || "10");

// Earth's radius in km for Haversine formula
const EARTH_RADIUS_KM = 6371;

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

export interface PincodeValidationResult {
  valid: boolean;
  message: string;
  suggestedAddress?: string;
}

export interface DistanceTimeResult {
  success: boolean;
  distanceKm?: number;
  estimatedMinutes?: number;
  estimatedSeconds?: number;
  estimatedTimeFormatted?: string;
  withinRange?: boolean;
  maxRadius?: number;
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

  // ========== PINCODE VALIDATION ==========
  async validatePincode(
    pincode: string,
    coordinates: [number, number],
  ): Promise<PincodeValidationResult> {
    if (!/^\d{6}$/.test(pincode)) {
      return { valid: false, message: "Pincode must be 6 digits" };
    }

    const reverse = await this.reverseGeocode(coordinates[0], coordinates[1]);
    if (!reverse.success)
      return { valid: false, message: "Invalid coordinates" };

    const foundPincode = reverse.pincode || reverse.components?.postcode;
    if (foundPincode && foundPincode !== pincode) {
      return {
        valid: false,
        message: `Pincode mismatch! Expected ${pincode}, found ${foundPincode}`,
        suggestedAddress: reverse.address,
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

    return {
      success: true,
      distanceKm,
      estimatedMinutes,
      estimatedSeconds: estimatedMinutes * 60,
      estimatedTimeFormatted: this.formatTime(estimatedMinutes),
      withinRange: distanceKm <= MAX_RADIUS,
      maxRadius: MAX_RADIUS,
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
  ): Promise<DeliveryCheckResult> {
    const result = await this.getDistanceAndTime(
      restaurantCoords,
      customerCoords,
    );
    if (!result.success) return result;

    return {
      ...result,
      deliverable: result.withinRange,
      message: result.withinRange
        ? `We deliver! Estimated time: ${result.estimatedTimeFormatted}`
        : `Sorry, we only deliver within ${MAX_RADIUS}km. You're ${result.distanceKm}km away.`,
    };
  }

  // ========== GET ROUTE COORDINATES FOR LIVE TRACKING ==========
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
