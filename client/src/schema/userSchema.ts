import { z } from "zod";

export const userSignupSchema = z.object({
  fullname: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(50, "Full name cannot exceed 50 characters"),
  email: z.string().email("Invalid email address").toLowerCase(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password cannot exceed 100 characters"),
  contact: z
    .string()
    .min(10, "Contact number must be exactly 10 digits")
    .max(10, "Contact number must be exactly 10 digits")
    .regex(/^\d+$/, "Contact number must contain only digits")
    .optional()
    .or(z.literal("")),
});

export type SignupInputState = z.infer<typeof userSignupSchema>;

export const userLoginSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginInputState = z.infer<typeof userLoginSchema>;

// Profile update schema (for frontend validation)
export const userProfileSchema = z.object({
  fullname: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(50, "Full name cannot exceed 50 characters")
    .optional(),
  contact: z
    .string()
    .min(10, "Contact number must be exactly 10 digits")
    .max(10, "Contact number must be exactly 10 digits")
    .regex(/^\d+$/, "Contact number must contain only digits")
    .optional()
    .or(z.literal("")),
  address: z.string().max(200).optional(),
  city: z.string().max(50).optional(),
  country: z.string().max(50).optional(),
});

export type ProfileInputState = z.infer<typeof userProfileSchema>;
