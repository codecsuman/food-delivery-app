import { Router, Request, Response } from "express";
import mapService from "../services/mapService.js";
import { Restaurant } from "../models/restaurant.model.js";

const router = Router();

// ========== CUSTOMER: Validate Address & Pincode ==========
router.post("/validate-address", async (req: Request, res: Response) => {
  try {
    const { address, pincode } = req.body;

    if (!address || !pincode) {
      return res
        .status(400)
        .json({ success: false, message: "Address and pincode required" });
    }

    const geoResult = await mapService.geocodeAddress(address, pincode);
    if (!geoResult.success) {
      return res
        .status(400)
        .json({ success: false, message: geoResult.message });
    }

    const pinValid = await mapService.validatePincode(
      pincode,
      geoResult.coordinates!,
    );

    res.json({
      success: true,
      coordinates: geoResult.coordinates,
      formattedAddress: geoResult.formattedAddress,
      pincodeValid: pinValid.valid,
      pincodeMessage: pinValid.message,
      suggestedAddress: pinValid.suggestedAddress || null,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== CUSTOMER: Check Delivery Availability ==========
router.post("/check-delivery", async (req: Request, res: Response) => {
  try {
    const { restaurantId, customerAddress, customerPincode } = req.body;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant || !restaurant.location?.coordinates) {
      return res
        .status(404)
        .json({ success: false, message: "Restaurant location not found" });
    }

    const geoResult = await mapService.geocodeAddress(
      customerAddress,
      customerPincode,
    );
    if (!geoResult.success) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid delivery address" });
    }

    const deliveryCheck = await mapService.checkDeliveryRange(
      restaurant.location.coordinates as [number, number],
      geoResult.coordinates!,
    );

    res.json(deliveryCheck);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== RESTAURANT OWNER: Get Distance to Customer ==========
router.post("/restaurant/distance", async (req: Request, res: Response) => {
  try {
    const { customerCoords, restaurantId } = req.body;

    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant?.location?.coordinates) {
      return res
        .status(404)
        .json({ success: false, message: "Restaurant location not set" });
    }

    const result = await mapService.getDistanceAndTime(
      restaurant.location.coordinates as [number, number],
      customerCoords as [number, number],
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== LIVE TRACKING: Get Route ==========
router.post("/tracking/route", async (req: Request, res: Response) => {
  try {
    const { driverCoords, customerCoords } = req.body;

    const distanceData = await mapService.getDistanceAndTime(
      driverCoords as [number, number],
      customerCoords as [number, number],
    );
    const routePoints = mapService.getRouteCoordinates(
      driverCoords as [number, number],
      customerCoords as [number, number],
    );

    res.json({
      ...distanceData,
      routeCoordinates: routePoints,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== SIMPLE: Calculate delivery time by distance ==========
router.post("/delivery-time", async (req: Request, res: Response) => {
  try {
    const { distanceKm } = req.body;
    if (!distanceKm || distanceKm <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Valid distance required" });
    }

    const result = mapService.calculateDeliveryTime(distanceKm);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== REVERSE GEOCODE (for map click) ==========
router.post("/reverse-geocode", async (req: Request, res: Response) => {
  try {
    const { lng, lat } = req.body;

    if (!lng || !lat) {
      return res
        .status(400)
        .json({ success: false, message: "Longitude and latitude required" });
    }

    const result = await mapService.reverseGeocode(lng, lat);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
