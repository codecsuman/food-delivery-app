import { z } from "zod";

export const restaurantFromSchema = z.object({
  restaurantName: z
    .string()
    .min(2, "Restaurant name must be at least 2 characters")
    .max(100, "Restaurant name cannot exceed 100 characters"),
  city: z.string().min(1, "City is required").max(50, "City name too long"),
  country: z
    .string()
    .min(1, "Country is required")
    .max(50, "Country name too long"),
  deliveryTime: z
    .number()
    .min(0, "Delivery time cannot be negative")
    .max(180, "Delivery time cannot exceed 180 minutes"),
  deliveryPrice: z
    .number()
    .min(0, "Delivery price cannot be negative")
    .max(10000, "Delivery price too high")
    .optional()
    .default(0),
  cuisines: z
    .array(z.string().min(1))
    .min(1, "At least one cuisine is required"),
  // FIX: lat/lng now part of the validated schema instead of separate
  // untyped state. Range-checked as real coordinates, and the (0,0)
  // "null island" default is explicitly rejected since that was the
  // exact bug ("Restaurant Location is [0,0]") from the original audit.
  lat: z
    .number({ invalid_type_error: "Latitude is required" })
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .refine((val) => val !== 0, {
      message: "Please set a valid restaurant location",
    }),
  lng: z
    .number({ invalid_type_error: "Longitude is required" })
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
    .refine((val) => val !== 0, {
      message: "Please set a valid restaurant location",
    }),
  imageFile: z
    .instanceof(File)
    .optional()
    .refine((file) => !file || file.size > 0, {
      message: "Image file cannot be empty",
    }),
});

export type RestaurantFormSchema = z.infer<typeof restaurantFromSchema>;
