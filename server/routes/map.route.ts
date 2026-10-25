import { Router, Request, Response } from "express";
import mapService from "../services/mapService.js";
import { Restaurant } from "../models/restaurant.model.js";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";
import { mapRateLimiter } from "../middlewares/rateLimit.js";
import { validate } from "../middlewares/validate.js";
import {
  validateAddressSchema,
  checkDeliverySchema,
  distanceSchema,
  trackingRouteSchema,
  reverseGeocodeSchema,
  pincodeParamSchema,
} from "../schemas/validation.js";
const router = Router();

// Apply rate limiting to all map routes
router.use(mapRateLimiter);

// Helper: reject missing/invalid/out-of-range/null-island coordinates
const isValidCoordinate = (coords: unknown): coords is [number, number] => {
  if (!Array.isArray(coords) || coords.length !== 2) return false;
  const [lng, lat] = coords;
  if (typeof lng !== "number" || typeof lat !== "number") return false;
  if (Number.isNaN(lng) || Number.isNaN(lat)) return false;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return false;
  if (lng === 0 && lat === 0) return false;
  return true;
};

// ========== PINCODE LOOKUP (Free, No API Key Required) ==========
router.get(
  "/pincode/:pincode",
  validate(pincodeParamSchema, "params"),
  async (req: Request, res: Response) => {
    try {
      const { pincode } = req.params;

      if (!/^\d{6}$/.test(pincode)) {
        return res.status(400).json({ success: false, message: "Pincode must be 6 digits" });
      }

      const result = await mapService.lookupPincode(pincode);

      if (!result.success) {
        return res.status(404).json({ success: false, message: result.message });
      }

      res.json({
        success: true,
        pincode: result.pincode,
        city: result.city,
        district: result.district,
        state: result.state,
        country: result.country,
        postOffices: result.postOffices?.map((po) => ({
          office_name: po.office_name,
          office_type: po.office_type,
          delivery_status: po.delivery_status,
          district: po.district,
          state: po.state,
          latitude: po.latitude,
          longitude: po.longitude,
        })) || [],
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ========== OPENCAGE AUTOCOMPLETE PROXY (keeps API key server-side) ==========
router.get(
  "/autocomplete",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== "string" || q.length < 3) {
        return res.status(400).json({ success: false, message: "Query too short" });
      }

      const OPENCAGE_KEY = process.env.OPENCAGE_API_KEY!;
      const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(q + ", India")}&key=${OPENCAGE_KEY}&limit=5&countrycode=in`;

      const axios = (await import("axios")).default;
      const response = await axios.get(url, { timeout: 5000 });

      if (response.data.results && response.data.results.length > 0) {
        return res.json({
          success: true,
          suggestions: response.data.results.map((r: any) => ({
            formatted: r.formatted,
            coordinates: [r.geometry.lng, r.geometry.lat],
            components: r.components,
            confidence: r.confidence,
          })),
        });
      }

      res.json({ success: true, suggestions: [] });
    } catch (error: any) {
      if (error.code === "ECONNABORTED") {
        return res.status(504).json({ success: false, message: "Geocoding service timeout" });
      }
      res.status(500).json({ success: false, message: "Autocomplete failed" });
    }
  }
);

// ========== CUSTOMER: Validate Address & Pincode ==========
router.post(
  "/validate-address",
  isAuthenticated,
  validate(validateAddressSchema),
  async (req: Request, res: Response) => {
    try {
      const { address, pincode, lat, lng } = req.body;

      // A pin dropped on the map (or the device GPS position) is the source of
      // truth. The geocoder is only used to fill in a formatted address/labels.
      const pickedCoords: [number, number] | null = isValidCoordinate([lng, lat])
        ? [lng, lat]
        : null;

      // Only geocode the text when the customer did not pick a pin. This avoids
      // pairing a new pin with an address returned for the old text address.
      let geoResult: Awaited<ReturnType<typeof mapService.geocodeAddress>> | null = null;
      if (!pickedCoords) {
        geoResult = await mapService.geocodeAddress(address, pincode);
        if (!geoResult.success || !isValidCoordinate(geoResult.coordinates)) {
          return res.status(400).json({
            success: false,
            message: geoResult.message || "Address not found. Please drop a pin on the map.",
          });
        }
      }

      const coordinates = pickedCoords ?? (geoResult && isValidCoordinate(geoResult.coordinates)
        ? geoResult.coordinates
        : null);

      if (!coordinates) {
        return res.status(400).json({
          success: false,
          message: "Address not found. Please drop a pin on the map.",
        });
      }

      // The pin/GPS position is authoritative, so derive the formatted address
      // from the pin itself. For text-only lookups keep the forward geocoder's
      // formatted address and fall back to reverse geocoding if necessary.
      let formattedAddress = geoResult?.formattedAddress || "";
      if (pickedCoords || !formattedAddress) {
        const reverse = await mapService.reverseGeocode(coordinates[0], coordinates[1]);
        if (reverse.success && reverse.address) formattedAddress = reverse.address;
      }

      const pinValid = await mapService.validatePincode(pincode, coordinates);

      res.json({
        success: true,
        coordinates,
        formattedAddress: formattedAddress || address,
        source: pickedCoords ? "map-pin" : "geocoder",
        pincodeValid: pinValid.valid,
        pincodeMessage: pinValid.message,
        suggestedAddress: pinValid.suggestedAddress || null,
        suggestedPincode: pinValid.suggestedPincode || null,
        city: pinValid.city,
        district: pinValid.district,
        state: pinValid.state,
        country: pinValid.country,
        postOffices: pinValid.postOffices,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ========== CUSTOMER: Check Delivery Availability ==========
router.post(
  "/check-delivery",
  isAuthenticated,
  validate(checkDeliverySchema),
  async (req: Request, res: Response) => {
    try {
      const { restaurantId, customerAddress, customerPincode, lat, lng } = req.body;

      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant || !isValidCoordinate(restaurant.location?.coordinates)) {
        return res.status(404).json({ success: false, message: "Restaurant location not found" });
      }

      // Prefer the pin/GPS coordinates; only geocode when they are absent.
      let customerCoordinates: [number, number] | null = isValidCoordinate([lng, lat])
        ? [lng, lat]
        : null;

      if (!customerCoordinates) {
        const geoResult = await mapService.geocodeAddress(customerAddress, customerPincode);
        if (!geoResult.success || !isValidCoordinate(geoResult.coordinates)) {
          return res.status(400).json({ success: false, message: "Invalid delivery address" });
        }
        customerCoordinates = geoResult.coordinates;
      }

      const deliveryCheck = await mapService.checkDeliveryRange(
        restaurant.location!.coordinates as [number, number],
        customerCoordinates
      );

      res.json(deliveryCheck);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ========== RESTAURANT OWNER: Get Distance to Customer ==========
router.post(
  "/restaurant/distance",
  isAuthenticated,
  validate(distanceSchema),
  async (req: Request, res: Response) => {
    try {
      const { customerCoords, restaurantId } = req.body;

      if (!isValidCoordinate(customerCoords)) {
        return res.status(400).json({ success: false, message: "Valid customer coordinates required" });
      }

      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant || !isValidCoordinate(restaurant.location?.coordinates)) {
        return res.status(404).json({ success: false, message: "Restaurant location not set" });
      }

      // Verify ownership
      if (restaurant.user.toString() !== req.id && !req.admin) {
        return res.status(403).json({ success: false, message: "Not authorized" });
      }

      const result = await mapService.getDistanceAndTime(
        restaurant.location!.coordinates as [number, number],
        customerCoords as [number, number]
      );

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ========== LIVE TRACKING: Get Route ==========
router.post(
  "/tracking/route",
  isAuthenticated,
  validate(trackingRouteSchema),
  async (req: Request, res: Response) => {
    try {
      const { driverCoords, customerCoords } = req.body;

      if (!isValidCoordinate(driverCoords) || !isValidCoordinate(customerCoords)) {
        return res.status(400).json({ success: false, message: "Valid coordinates required" });
      }

      const distanceData = await mapService.getDistanceAndTime(driverCoords, customerCoords);
      const routePoints = mapService.getRouteCoordinates(driverCoords, customerCoords);

      res.json({ ...distanceData, routeCoordinates: routePoints });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ========== SIMPLE: Calculate delivery time by distance ==========
router.post(
  "/delivery-time",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { distanceKm } = req.body;
      if (!distanceKm || distanceKm <= 0) {
        return res.status(400).json({ success: false, message: "Valid distance required" });
      }

      const result = mapService.calculateDeliveryTime(distanceKm);
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ========== REVERSE GEOCODE (for map click) ==========
router.post(
  "/reverse-geocode",
  isAuthenticated,
  validate(reverseGeocodeSchema),
  async (req: Request, res: Response) => {
    try {
      const { lng, lat } = req.body;
      const result = await mapService.reverseGeocode(lng, lat);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

export default router;