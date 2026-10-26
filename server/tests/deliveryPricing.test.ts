import { describe, it, expect } from "vitest";
import {
  calculateDeliveryPricing,
  EXTRA_DELIVERY_CHARGE_PER_KM,
  MAX_DELIVERY_RADIUS_KM,
  STANDARD_DELIVERY_RADIUS_KM,
} from "../services/deliveryPricing.js";

describe("Distance-based delivery pricing", () => {
  it("uses only the restaurant base fee within the standard radius", () => {
    const pricing = calculateDeliveryPricing(5, 50);

    expect(pricing.extraDistanceKm).toBe(0);
    expect(pricing.extraFee).toBe(0);
    expect(pricing.deliveryFee).toBe(50);
    expect(pricing.baseFee).toBe(50);
    expect(pricing.withinRange).toBe(true);
  });

  it("never charges the base fee twice", () => {
    const pricing = calculateDeliveryPricing(5, 40);

    expect(pricing.deliveryFee).toBe(40);
    expect(pricing.deliveryFee).not.toBe(80);
  });

  it("charges ₹5 for every km beyond 5 km", () => {
    const pricing = calculateDeliveryPricing(7.4, 50);

    expect(pricing.extraDistanceKm).toBe(2.4);
    expect(pricing.extraFee).toBe(12);
    expect(pricing.deliveryFee).toBe(62);
  });

  it("allows delivery exactly at the maximum radius", () => {
    const pricing = calculateDeliveryPricing(MAX_DELIVERY_RADIUS_KM, 0);

    expect(pricing.withinRange).toBe(true);
  });

  it("blocks delivery beyond the configured maximum radius", () => {
    const pricing = calculateDeliveryPricing(MAX_DELIVERY_RADIUS_KM + 0.1, 0);

    expect(pricing.withinRange).toBe(false);
  });

  it("exposes the configured rule values for the UI", () => {
    const pricing = calculateDeliveryPricing(6, 0);

    expect(pricing.standardRadiusKm).toBe(STANDARD_DELIVERY_RADIUS_KM);
    expect(pricing.chargePerExtraKm).toBe(EXTRA_DELIVERY_CHARGE_PER_KM);
    expect(pricing.maxRadius).toBe(MAX_DELIVERY_RADIUS_KM);
  });

  it("handles invalid or negative distances safely", () => {
    expect(calculateDeliveryPricing(Number.NaN, 25).deliveryFee).toBe(25);
    expect(calculateDeliveryPricing(-3, 25).deliveryFee).toBe(25);
    expect(calculateDeliveryPricing(6, -100).deliveryFee).toBe(5);
  });
});
