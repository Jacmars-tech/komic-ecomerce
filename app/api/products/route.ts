import { NextRequest } from "next/server";

import { fail, isErrorResponse, ok, parseWithSchema, requireAuth } from "@/lib/api";
import { setSessionCookie, signSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { productUpsertSchema } from "@/lib/validators";

function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const q = searchParams.get("q")?.trim();
  const category = searchParams.get("category")?.trim();
  const brand = searchParams.get("brand")?.trim();
  const minPrice = parseNumber(searchParams.get("minPrice"));
  const maxPrice = parseNumber(searchParams.get("maxPrice"));
  const sort = searchParams.get("sort") || "newest";

  const andConditions: object[] = [];
  if (q) {
    andConditions.push({
      OR: [{ name: { contains: q } }, { description: { contains: q } }, { sku: { contains: q } }, { brand: { contains: q } }]
    });
  }
  if (category) {
    andConditions.push({ category: { slug: category } });
  }
  if (brand) {
    andConditions.push({ brand: { equals: brand } });
  }
  if (minPrice !== null) {
    andConditions.push({ priceCents: { gte: Math.round(minPrice * 100) } });
  }
  if (maxPrice !== null) {
    andConditions.push({ priceCents: { lte: Math.round(maxPrice * 100) } });
  }
  const where = andConditions.length > 0 ? { AND: andConditions } : {};

  const products = await prisma.product.findMany({
    where,
    include: {
      category: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      variants: true,
      _count: { select: { reviews: true } }
    }
  });

  const ratingStats = await prisma.review.groupBy({
    by: ["productId"],
    where: {
      approved: true,
      productId: { in: products.map((product) => product.id) }
    },
    _avg: { rating: true },
    _count: { rating: true }
  });

  const ratingByProduct = new Map(
    ratingStats.map((entry) => [
      entry.productId,
      { average: Number(entry._avg.rating || 0), total: entry._count.rating }
    ])
  );

  const responseProducts = products.map((product) => {
    const rating = ratingByProduct.get(product.id) || { average: 0, total: 0 };
    return {
      ...product,
      rating
    };
  });

  responseProducts.sort((a, b) => {
    if (sort === "price_asc") return a.priceCents - b.priceCents;
    if (sort === "price_desc") return b.priceCents - a.priceCents;
    if (sort === "rating") return b.rating.average - a.rating.average;
    if (sort === "popularity") {
      const scoreA = (a.bestSeller ? 5 : 0) + a.rating.total;
      const scoreB = (b.bestSeller ? 5 : 0) + b.rating.total;
      return scoreB - scoreA;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const facets = {
    brands: await prisma.product.groupBy({ by: ["brand"] }),
    categories: await prisma.category.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" }
    })
  };

  return ok({ products: responseProducts, facets });
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

  const parsed = parseWithSchema(productUpsertSchema, body);
  if (parsed.error || !parsed.data) {
    return fail(parsed.error || "Validation failed", 422);
  }

  const payload = parsed.data;

  let effectiveRole = auth.role;
  if (auth.role === "USER") {
    const promoted = await prisma.user.update({
      where: { id: auth.id },
      data: { role: "VENDOR" }
    });

    if (promoted) {
      effectiveRole = "VENDOR";
      const token = signSessionToken({
        id: promoted.id,
        email: promoted.email,
        name: promoted.name,
        role: "VENDOR"
      });
      setSessionCookie(token);
    }
  }

  const defaultVendor =
    effectiveRole === "VENDOR"
      ? auth.id
      : (
          await prisma.user.findFirst({
            where: { role: "VENDOR" },
            select: { id: true }
          })
        )?.id || auth.id;

  const categorySlug = payload.categorySlug || "general";
  let category = await prisma.category.findUnique({ where: { slug: categorySlug } });
  if (!category) {
    category = await prisma.category.create({
      data: {
        name: categorySlug.replace(/-/g, " "),
        slug: categorySlug
      }
    });
  }

  const baseSlug = slugify(payload.name);
  let uniqueSlug = baseSlug;
  let counter = 1;

  while (await prisma.product.findUnique({ where: { slug: uniqueSlug } })) {
    uniqueSlug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  const created = await prisma.product.create({
    data: {
      slug: uniqueSlug,
      name: payload.name,
      description: payload.description,
      sku: payload.sku,
      brand: payload.brand,
      priceCents: payload.priceCents,
      discountPriceCents: payload.discountPriceCents || null,
      stockQuantity: payload.stockQuantity,
      vendorId: defaultVendor,
      categoryId: category.id,
      tags: JSON.stringify(payload.tags || []),
      featured: Boolean(payload.featured),
      newArrival: Boolean(payload.newArrival),
      bestSeller: Boolean(payload.bestSeller),
      specifications: JSON.stringify({
        source: "admin"
      }),
      images: {
        create: payload.imageUrls.map((url, index) => ({
          url,
          sortOrder: index,
          altText: payload.name
        }))
      }
    },
    include: {
      category: true,
      images: true
    }
  });

  return ok(
    {
      product: created,
      sellerRole: effectiveRole
    },
    201
  );
}
