import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, isErrorResponse, ok, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().min(8).max(4000).optional(),
  brand: z.string().min(2).max(80).optional(),
  priceCents: z.number().int().positive().optional(),
  discountPriceCents: z.number().int().positive().nullable().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  featured: z.boolean().optional(),
  newArrival: z.boolean().optional(),
  bestSeller: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  imageUrls: z.array(z.string().url()).optional()
});

async function resolveProduct(idOrSlug: string) {
  const byId = await prisma.product.findUnique({
    where: { id: idOrSlug },
    include: {
      category: true,
      images: { orderBy: { sortOrder: "asc" } },
      variants: true,
      reviews: {
        where: { approved: true },
        include: {
          user: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (byId) return byId;

  return prisma.product.findUnique({
    where: { slug: idOrSlug },
    include: {
      category: true,
      images: { orderBy: { sortOrder: "asc" } },
      variants: true,
      reviews: {
        where: { approved: true },
        include: {
          user: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });
}

export async function GET(_: NextRequest, context: { params: { id: string } }) {
  const product = await resolveProduct(context.params.id);

  if (!product) {
    return fail("Product not found", 404);
  }

  const relatedOr: Array<{ brand?: string; categoryId?: string }> = [{ brand: product.brand }];
  if (product.categoryId) {
    relatedOr.push({ categoryId: product.categoryId });
  }

  const related = await prisma.product.findMany({
    where: {
      id: { not: product.id },
      OR: relatedOr
    },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 }
    },
    take: 4
  });

  const ratingAverage =
    product.reviews.length > 0
      ? product.reviews.reduce((total, review) => total + review.rating, 0) / product.reviews.length
      : 0;

  return ok({
    product: {
      ...product,
      rating: {
        average: ratingAverage,
        total: product.reviews.length
      }
    },
    related
  });
}

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  const auth = requireRole(["ADMIN", "VENDOR"]);
  if (isErrorResponse(auth)) {
    return auth;
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return fail("Invalid request body", 400);
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const product = await resolveProduct(context.params.id);
  if (!product) {
    return fail("Product not found", 404);
  }
  if (auth.role === "VENDOR" && product.vendorId !== auth.id) {
    return fail("Forbidden", 403);
  }

  const payload = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: product.id },
      data: {
        name: payload.name,
        description: payload.description,
        brand: payload.brand,
        priceCents: payload.priceCents,
        discountPriceCents: payload.discountPriceCents,
        stockQuantity: payload.stockQuantity,
        featured: payload.featured,
        newArrival: payload.newArrival,
        bestSeller: payload.bestSeller,
        tags: payload.tags ? JSON.stringify(payload.tags) : undefined
      }
    });

    if (payload.imageUrls) {
      await tx.productImage.deleteMany({ where: { productId: product.id } });
      await tx.productImage.createMany({
        data: payload.imageUrls.map((url, index) => ({
          productId: product.id,
          url,
          altText: payload.name || product.name,
          sortOrder: index
        }))
      });
    }
  });

  const updated = await resolveProduct(product.id);
  return ok({ product: updated });
}

export async function DELETE(_: NextRequest, context: { params: { id: string } }) {
  const auth = requireRole(["ADMIN", "VENDOR"]);
  if (isErrorResponse(auth)) {
    return auth;
  }

  const product = await resolveProduct(context.params.id);
  if (!product) {
    return fail("Product not found", 404);
  }
  if (auth.role === "VENDOR" && product.vendorId !== auth.id) {
    return fail("Forbidden", 403);
  }

  await prisma.product.delete({ where: { id: product.id } });
  return ok({ message: "Product deleted" });
}

