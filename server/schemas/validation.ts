import { z } from "zod";

export const signupSchema = z.object({
  fullname: z.string().min(2, "Fullname must be at least 2 characters").max(50),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
  contact: z.string().regex(/^\d{10}$/, "Contact must be 10 digits").optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
  fullname: z.string().min(2).max(50).optional(),
  email: z.string().email().optional(),
  // An empty string is how the profile form clears an optional phone number.
  // Reject anything that is not empty or a complete 10-digit number.
  contact: z
    .union([z.literal(""), z.string().regex(/^\d{10}$/)])
    .nullable()
    .optional(),
  alternateContact: z
    .union([z.literal(""), z.string().regex(/^\d{10}$/)])
    .nullable()
    .optional(),
  address: z.string().max(500).optional(),
  // Clearing the pincode is allowed, but a partially typed pincode is not.
  pincode: z
    .union([z.literal(""), z.string().regex(/^\d{6}$/)])
    .optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  // Coordinates captured from device GPS or the map pin. `null` explicitly
  // clears a previously saved pin.
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  profilePicture: z
    .union([z.literal(""), z.string().url()])
    .optional()
    .nullable(),
});

// Multipart/form-data sends every field as a string. Coerce the numeric
// fields so `validate(...)` accepts the real payloads sent by the client.
const multipartNumber = z.coerce.number();

// Checkboxes/booleans also arrive as strings inside multipart/form-data.
const multipartBoolean = z.preprocess((value) => {
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return value;
}, z.boolean());

// `cuisines` is sent either as a real array (JSON requests/tests) or as a
// JSON-encoded string inside FormData (the browser client).
const cuisinesField = z.preprocess((value) => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}, z.array(z.string().min(1).max(50)).min(1));

export const createRestaurantSchema = z.object({
  restaurantName: z.string().min(2).max(100),
  address: z.string().min(5, "Restaurant address is required").max(500),
  city: z.string().min(1).max(50),
  state: z.string().min(1, "State is required").max(50),
  country: z.string().min(1).max(50),
  pincode: z.string().regex(/^\d{6}$/),
  contact: z.string().regex(/^\d{10}$/, "Contact must be 10 digits"),
  alternateContact: z
    .union([z.literal(""), z.string().regex(/^\d{10}$/)])
    .optional(),
  deliveryTime: multipartNumber.pipe(z.number().int().min(0).max(180)),
  deliveryPrice: multipartNumber.pipe(z.number().min(0).max(10000)).optional(),
  cuisines: cuisinesField,
  lat: multipartNumber.pipe(z.number().min(-90).max(90)),
  lng: multipartNumber.pipe(z.number().min(-180).max(180)),
});

export const updateRestaurantSchema = z.object({
  restaurantName: z.string().min(2).max(100).optional(),
  address: z.string().min(5).max(500).optional(),
  city: z.string().min(1).max(50).optional(),
  state: z.string().min(1).max(50).optional(),
  country: z.string().min(1).max(50).optional(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
  contact: z
    .union([z.literal(""), z.string().regex(/^\d{10}$/)])
    .optional(),
  alternateContact: z
    .union([z.literal(""), z.string().regex(/^\d{10}$/)])
    .optional(),
  deliveryTime: multipartNumber.pipe(z.number().int().min(0).max(180)).optional(),
  deliveryPrice: multipartNumber.pipe(z.number().min(0).max(10000)).optional(),
  cuisines: cuisinesField.optional(),
  lat: multipartNumber.pipe(z.number().min(-90).max(90)).optional(),
  lng: multipartNumber.pipe(z.number().min(-180).max(180)).optional(),
});

export const addMenuSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().min(5).max(500),
  price: multipartNumber.pipe(z.number().min(0).max(100000)),
  // Optional: owners with multiple restaurants send the target restaurant.
  restaurantId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  isAvailable: multipartBoolean.optional(),
});

export const updateMenuSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().min(5).max(500).optional(),
  price: multipartNumber.pipe(z.number().min(0).max(100000)).optional(),
  isAvailable: multipartBoolean.optional(),
});

export const updateMenuAvailabilitySchema = z.object({
  isAvailable: multipartBoolean,
});

export const checkoutSchema = z.object({
  cartItems: z.array(
    z.object({
      menuId: z.string(),
      name: z.string(),
      image: z.string(),
      price: z.number().min(0),
      quantity: z.number().int().min(1),
    })
  ).min(1),
  deliveryDetails: z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    address: z.string().min(5).max(500),
    city: z.string().min(1).max(100),
    state: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
    pincode: z.string().regex(/^\d{6}$/),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  }),
  restaurantId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  paymentMethod: z.enum(["stripe", "cod"]).default("stripe"),
  // Generated by the checkout UI. Retrying the same submission returns the
  // original order instead of creating (and charging for) a duplicate.
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

export const validateAddressSchema = z.object({
  address: z.string().min(5).max(500),
  pincode: z.string().regex(/^\d{6}$/),
  // Optional map-pin coordinates. When the customer clicks/drags the pin (or
  // uses device GPS), these are authoritative over the geocoder so the order
  // is stored at the exact spot they picked rather than a stale text match.
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const checkDeliverySchema = z.object({
  restaurantId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  customerAddress: z.string().min(5).max(500),
  customerPincode: z.string().regex(/^\d{6}$/),
  // Same as validateAddressSchema — used for fast, accurate distance/ETA
  // checks without re-geocoding an address the customer already pinned.
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const distanceSchema = z.object({
  customerCoords: z.tuple([z.number(), z.number()]),
  restaurantId: z.string().regex(/^[0-9a-fA-F]{24}$/),
});

export const trackingRouteSchema = z.object({
  driverCoords: z.tuple([z.number(), z.number()]),
  customerCoords: z.tuple([z.number(), z.number()]),
});

export const reverseGeocodeSchema = z.object({
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});

export const addReviewSchema = z.object({
  restaurantId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  menuItemId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional().nullable(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(3).max(1000),
  userName: z.string().min(1).max(100).optional(),
  userImage: z.string().url().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "pending",
    "confirmed",
    "preparing",
    "outfordelivery",
    "delivered",
    "cancelled",
    "payment_failed",
  ]),
});

export const driverLocationSchema = z.object({
  orderId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  location: z.object({
    lng: z.number().min(-180).max(180),
    lat: z.number().min(-90).max(90),
  }),
  status: z.enum([
    "pending",
    "confirmed",
    "preparing",
    "outfordelivery",
    "delivered",
    "cancelled",
    "payment_failed",
  ]),
});

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/);

// NOTE: route params are objects (`req.params`), so param validation schemas
// must be objects too — validating `req.params` with a bare string schema
// always fails and rejects every request.
export const idParamSchema = z.object({ id: objectIdSchema });
export const orderIdParamSchema = z.object({ orderId: objectIdSchema });
export const restaurantIdParamSchema = z.object({ restaurantId: objectIdSchema });

export const pincodeParamSchema = z.object({
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be exactly 6 digits"),
});

// Stripe Checkout Session IDs look like `cs_test_...` / `cs_live_...`.
// They are NOT MongoDB ObjectIds, so they must never be validated with
// objectIdSchema.
export const stripeSessionIdSchema = z
  .string()
  .regex(/^cs_(test|live)_[A-Za-z0-9_]+$/, "Invalid Stripe checkout session ID");

export const stripeSessionIdParamSchema = z.object({
  sessionId: stripeSessionIdSchema,
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ======================= ORDER ISSUES =======================
export const createIssueSchema = z.object({
  orderId: objectIdSchema,
  type: z.enum([
    "missing_item",
    "wrong_item",
    "cold_food",
    "late_delivery",
    "payment",
    "hygiene",
    "other",
  ]),
  description: z.string().min(10).max(1000),
});

export const updateIssueStatusSchema = z.object({
  status: z.enum(["in_review", "resolved", "rejected"]),
  resolutionNote: z.string().max(500).optional(),
});

export const issueIdParamSchema = z.object({ issueId: objectIdSchema });

export const issueListQuerySchema = z.object({
  status: z.enum(["open", "in_review", "resolved", "rejected"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// ======================= OWNER ANALYTICS =======================
export const analyticsQuerySchema = z.object({
  range: z.enum(["7d", "30d", "90d", "all"]).optional(),
});

export const searchSchema = z.object({
  searchQuery: z.string().optional(),
  selectedCuisines: z.string().optional(),
  city: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
});