import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, isErrorResponse, ok, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const upsertSchema = z.object({
  productId: z.string().min(5),
  variantId: z.string().optional().nullable(),
  quantity: z.number().int().min(1).max(20)
});

const removeSchema = z.object({
  cartItemId: z.string().min(5)
});

export async function GET() {
  const auth = requireAuth();
  if (isErrorResponse(auth)) {
    return auth;
  }

  const items = await prisma.cartItem.findMany({
    where: { userId: auth.id },
    include: {
      product: {
        include: {
          images: { orderBy: { sortOrder: "asc" }, take: 1 }
        }
      },
      variant: true
    },
    orderBy: { updatedAt: "desc" }
  });

  return ok({ items });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth();
  if (isErrorResponse(auth)) {
    return auth;
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return fail("Invalid request body", 400);
  }

  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const payload = parsed.data;

  const product = await prisma.product.findUnique({ where: { id: payload.productId } });
  if (!product) {
    return fail("Product not found", 404);
  }

  if (product.stockQuantity < payload.quantity) {
    return fail("Insufficient stock", 409);
  }

  const existing = await prisma.cartItem.findFirst({
    where: {
      userId: auth.id,
      productId: payload.productId,
      variantId: payload.variantId || null
    }
  });

  const item = existing
    ? await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: payload.quantity }
      })
    : await prisma.cartItem.create({
        data: {
          userId: auth.id,
          productId: payload.productId,
          variantId: payload.variantId || null,
          quantity: payload.quantity
        }
      });

  return ok({ item }, existing ? 200 : 201);
}

export async function PATCH(req: NextRequest) {
  const auth = requireAuth();
  if (isErrorResponse(auth)) {
    return auth;
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return fail("Invalid request body", 400);
  }

  const parsed = upsertSchema.extend({ cartItemId: z.string().min(5) }).safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const item = await prisma.cartItem.findUnique({ where: { id: parsed.data.cartItemId } });
  if (!item || item.userId !== auth.id) {
    return fail("Cart item not found", 404);
  }

  const updated = await prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity: parsed.data.quantity }
  });

  return ok({ item: updated });
}

export async function DELETE(req: NextRequest) {
  const auth = requireAuth();
  if (isErrorResponse(auth)) {
    return auth;
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    await prisma.cartItem.deleteMany({ where: { userId: auth.id } });
    return ok({ message: "Cart cleared" });
  }

  const parsed = removeSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const item = await prisma.cartItem.findUnique({ where: { id: parsed.data.cartItemId } });
  if (!item || item.userId !== auth.id) {
    return fail("Cart item not found", 404);
  }

  await prisma.cartItem.delete({ where: { id: item.id } });
  return ok({ message: "Item removed" });
}
