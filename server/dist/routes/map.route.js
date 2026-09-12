import { Router } from "express";
import mapService from "../services/mapService.js";
import { Restaurant } from "../models/restaurant.model.js";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";
const router = Router();
// Helper: reject missing/invalid/null-island coordinates
const isValidCoordinate = (coords) => {
    if (!Array.isArray(coords) || coords.length !== 2)
        return false;
    const [lng, lat] = coords;
    if (typeof lng !== "number" || typeof lat !== "number")
        return false;
    if (Number.isNaN(lng) || Number.isNaN(lat))
        return false;
    if (lng === 0 && lat === 0)
        return false; // reject "null island" — almost always a missing-data default
    return true;
};
// ========== CUSTOMER: Validate Address & Pincode ==========
router.post("/validate-address", isAuthenticated, async (req, res) => {
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
        const pinValid = await mapService.validatePincode(pincode, geoResult.coordinates);
        res.json({
            success: true,
            coordinates: geoResult.coordinates,
            formattedAddress: geoResult.formattedAddress,
            pincodeValid: pinValid.valid,
            pincodeMessage: pinValid.message,
            suggestedAddress: pinValid.suggestedAddress || null,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// ========== CUSTOMER: Check Delivery Availability ==========
router.post("/check-delivery", isAuthenticated, async (req, res) => {
    try {
        const { restaurantId, customerAddress, customerPincode } = req.body;
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant || !isValidCoordinate(restaurant.location?.coordinates)) {
            return res
                .status(404)
                .json({ success: false, message: "Restaurant location not found" });
        }
        const geoResult = await mapService.geocodeAddress(customerAddress, customerPincode);
        if (!geoResult.success) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid delivery address" });
        }
        const deliveryCheck = await mapService.checkDeliveryRange(restaurant.location.coordinates, geoResult.coordinates);
        res.json(deliveryCheck);
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// ========== RESTAURANT OWNER: Get Distance to Customer ==========
router.post("/restaurant/distance", isAuthenticated, async (req, res) => {
    try {
        const { customerCoords, restaurantId } = req.body;
        if (!isValidCoordinate(customerCoords)) {
            return res.status(400).json({
                success: false,
                message: "Valid customer coordinates required",
            });
        }
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant || !isValidCoordinate(restaurant.location?.coordinates)) {
            return res
                .status(404)
                .json({ success: false, message: "Restaurant location not set" });
        }
        const result = await mapService.getDistanceAndTime(restaurant.location.coordinates, customerCoords);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// ========== LIVE TRACKING: Get Route ==========
router.post("/tracking/route", isAuthenticated, async (req, res) => {
    try {
        const { driverCoords, customerCoords } = req.body;
        if (!isValidCoordinate(driverCoords) ||
            !isValidCoordinate(customerCoords)) {
            return res.status(400).json({
                success: false,
                message: "Valid driver and customer coordinates required",
            });
        }
        const distanceData = await mapService.getDistanceAndTime(driverCoords, customerCoords);
        const routePoints = mapService.getRouteCoordinates(driverCoords, customerCoords);
        res.json({
            ...distanceData,
            routeCoordinates: routePoints,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// ========== SIMPLE: Calculate delivery time by distance ==========
router.post("/delivery-time", isAuthenticated, async (req, res) => {
    try {
        const { distanceKm } = req.body;
        if (!distanceKm || distanceKm <= 0) {
            return res
                .status(400)
                .json({ success: false, message: "Valid distance required" });
        }
        const result = mapService.calculateDeliveryTime(distanceKm);
        res.json({ success: true, ...result });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// ========== REVERSE GEOCODE (for map click) ==========
router.post("/reverse-geocode", isAuthenticated, async (req, res) => {
    try {
        const { lng, lat } = req.body;
        if (typeof lng !== "number" ||
            typeof lat !== "number" ||
            Number.isNaN(lng) ||
            Number.isNaN(lat)) {
            return res
                .status(400)
                .json({ success: false, message: "Longitude and latitude required" });
        }
        const result = await mapService.reverseGeocode(lng, lat);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
export default router;
