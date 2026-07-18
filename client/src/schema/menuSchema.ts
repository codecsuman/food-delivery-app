import { z } from "zod";

export const menuSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters"),
  description: z
    .string()
    .min(5, "Description must be at least 5 characters")
    .max(500, "Description cannot exceed 500 characters"),
  price: z
    .number()
    .min(0, "Price cannot be negative")
    .max(100000, "Price cannot exceed 100,000"),
  image: z
    .instanceof(File)
    .optional()
    .refine((file) => !file || file.size > 0, {
      message: "Image file cannot be empty",
    }),
});

export type MenuFormSchema = z.infer<typeof menuSchema>;
