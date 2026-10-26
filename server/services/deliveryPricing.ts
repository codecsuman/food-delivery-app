/**
 * Single source of truth for distance-based delivery pricing.
 *
 * Rules:
 *  - The first `STANDARD_DELIVERY_RADIUS_KM` (default 5 km) is covered by the
 *    restaurant's own base delivery fee.
 *  - Every km beyond that costs `EXTRA_DELIVERY_CHARGE_PER_KM` (default ₹5).
 *  - Orders beyond `MAX_DELIVERY_RADIUS_KM` (default 10 km) are not deliverable.
 *
 * The base fee is counted exactly once: `deliveryFee = baseFee + extraFee`.
 */

const readPositiveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const STANDARD_DELIVERY_RADIUS_KM = readPositiveNumber(
  process.env.STANDARD_DELIVERY_RADIUS_KM,
  5,
);

export const EXTRA_DELIVERY_CHARGE_PER_KM = readPositiveNumber(
  process.env.EXTRA_DELIVERY_CHARGE_PER_KM,
  5,
);

export const MAX_DELIVERY_RADIUS_KM = readPositiveNumber(
  process.env.MAX_DELIVERY_RADIUS_KM,
  10,
);

// Small allowance for restaurant preparation on top of travel time.
export const DELIVERY_PREP_MINUTES = readPositiveNumber(
  process.env.DELIVERY_PREP_MINUTES,
  8,
);

export interface DeliveryPricing {
  distanceKm: number;
  withinRange: boolean;
  maxRadius: number;
  standardRadiusKm: number;
  chargePerExtraKm: number;
  baseFee: number;
  extraDistanceKm: number;
  extraFee: number;
  deliveryFee: number;
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function calculateDeliveryPricing(
  distanceKm: number,
  baseFee = 0,
): DeliveryPricing {
  const safeDistance = Number.isFinite(distanceKm)
    ? Math.max(0, distanceKm)
    : 0;
  const safeBaseFee = Number.isFinite(baseFee) ? Math.max(0, baseFee) : 0;

  const extraDistanceKm = Math.max(
    0,
    safeDistance - STANDARD_DELIVERY_RADIUS_KM,
  );
  const extraFee = roundMoney(
    extraDistanceKm * EXTRA_DELIVERY_CHARGE_PER_KM,
  );

  return {
    distanceKm: roundMoney(safeDistance),
    withinRange: safeDistance <= MAX_DELIVERY_RADIUS_KM,
    maxRadius: MAX_DELIVERY_RADIUS_KM,
    standardRadiusKm: STANDARD_DELIVERY_RADIUS_KM,
    chargePerExtraKm: EXTRA_DELIVERY_CHARGE_PER_KM,
    baseFee: roundMoney(safeBaseFee),
    extraDistanceKm: roundMoney(extraDistanceKm),
    extraFee,
    deliveryFee: roundMoney(safeBaseFee + extraFee),
  };
}
