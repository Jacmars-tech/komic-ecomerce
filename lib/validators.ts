import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().min(8).max(20),
  password: z.string().min(8).max(128)
});

export const loginSchema = z.object({
  identifier: z.string().min(3).max(120),
  password: z.string().min(8).max(128)
});

export const productUpsertSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().min(8).max(4000),
  sku: z.string().min(3).max(64),
  brand: z.string().min(2).max(80),
  priceCents: z.number().int().positive(),
  discountPriceCents: z.number().int().positive().optional().nullable(),
  stockQuantity: z.number().int().min(0),
  categorySlug: z.string().min(2).optional(),
  imageUrls: z.array(z.string().url()).min(1),
  tags: z.array(z.string().min(1).max(40)).optional(),
  featured: z.boolean().optional(),
  newArrival: z.boolean().optional(),
  bestSeller: z.boolean().optional()
});

export const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(5),
        variantId: z.string().min(5).optional().nullable(),
        quantity: z.number().int().min(1).max(20)
      })
    )
    .min(1),
  shipping: z.object({
    name: z.string().min(2),
    phone: z.string().min(8),
    line1: z.string().min(2),
    line2: z.string().optional().or(z.literal("")),
    city: z.string().min(2),
    state: z.string().min(2),
    postalCode: z.string().min(2),
    country: z.string().min(2)
  }),
  paymentMethod: z.enum(["CARD", "MPESA", "BANK_TRANSFER", "CASH_ON_DELIVERY"]),
  couponCode: z.string().max(40).optional().or(z.literal("")),
  idempotencyKey: z.string().min(10).max(200),
  guestEmail: z.string().email().optional().or(z.literal(""))
});

export const reviewSchema = z.object({
  productId: z.string().min(5),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional().or(z.literal(""))
});

export const couponSchema = z.object({
  code: z.string().min(2).max(40)
});
