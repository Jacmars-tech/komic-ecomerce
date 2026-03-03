import { NextRequest } from "next/server";

import { fail, isErrorResponse, ok, parseWithSchema, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { reviewSchema } from "@/lib/validators";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");

  if (!productId) {
    return fail("productId is required", 422);
  }

  const reviews = await prisma.review.findMany({
    where: {
      productId,
      approved: true
    },
    include: {
      user: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return ok({ reviews });
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

  const parsed = parseWithSchema(reviewSchema, body);
  if (parsed.error || !parsed.data) {
    return fail(parsed.error || "Validation failed", 422);
  }

  const payload = parsed.data;

  const product = await prisma.product.findUnique({ where: { id: payload.productId } });
  if (!product) {
    return fail("Product not found", 404);
  }

  const existing = await prisma.review.findUnique({
    where: {
      userId_productId: {
        userId: auth.id,
        productId: payload.productId
      }
    }
  });

  if (existing) {
    return fail("You already reviewed this product", 409);
  }

  const orderItem = await prisma.orderItem.findFirst({
    where: {
      productId: payload.productId,
      order: {
        userId: auth.id,
        status: {
          in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"]
        }
      }
    },
    orderBy: {
      order: {
        createdAt: "desc"
      }
    }
  });

  const review = await prisma.review.create({
    data: {
      userId: auth.id,
      productId: payload.productId,
      orderItemId: orderItem?.id,
      rating: payload.rating,
      comment: payload.comment || null,
      verifiedPurchase: Boolean(orderItem),
      approved: false
    }
  });

  return ok({
    review,
    message: "Review submitted and pending moderation"
  }, 201);
}
