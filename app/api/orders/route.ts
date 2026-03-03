import { randomUUID } from "crypto";
import { NextRequest } from "next/server";

import { fail, isErrorResponse, ok, parseWithSchema, requireAuth } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { emitOrderPlaced } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { checkoutSchema } from "@/lib/validators";

const TAX_RATE = Number(process.env.NEXT_PUBLIC_TAX_RATE || "0.16");
type PaymentMethodValue = "CARD" | "MPESA" | "BANK_TRANSFER" | "CASH_ON_DELIVERY";

function computeShippingCents(city: string, country: string): number {
  const normalizedCity = city.trim().toLowerCase();
  const normalizedCountry = country.trim().toLowerCase();

  if (normalizedCountry !== "kenya") {
    return 180000;
  }

  if (normalizedCity.includes("nairobi")) {
    return 50000;
  }

  return 90000;
}

function ensurePaymentMethod(method: string): PaymentMethodValue {
  if (method === "CARD") return "CARD";
  if (method === "MPESA") return "MPESA";
  if (method === "BANK_TRANSFER") return "BANK_TRANSFER";
  return "CASH_ON_DELIVERY";
}

async function resolveDiscount(subtotalCents: number, couponCode?: string | null) {
  if (!couponCode) {
    return { discountCents: 0, couponId: null as string | null };
  }

  const coupon = await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
  if (!coupon || !coupon.active) {
    return { discountCents: 0, couponId: null };
  }

  const now = new Date();
  if ((coupon.startsAt && coupon.startsAt > now) || (coupon.endsAt && coupon.endsAt < now)) {
    return { discountCents: 0, couponId: null };
  }

  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    return { discountCents: 0, couponId: null };
  }

  if (subtotalCents < coupon.minimumOrderCents) {
    return { discountCents: 0, couponId: null };
  }

  const discountCents =
    coupon.discountType === "percentage"
      ? Math.round((subtotalCents * coupon.discountValue) / 100)
      : coupon.discountValue;

  return { discountCents: Math.min(discountCents, subtotalCents), couponId: coupon.id };
}

export async function GET(req: NextRequest) {
  const auth = requireAuth();
  if (isErrorResponse(auth)) {
    return auth;
  }

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");

  if (scope === "all") {
    if (auth.role === "ADMIN") {
      const orders = await prisma.order.findMany({
        include: {
          items: true,
          user: { select: { id: true, name: true, email: true } },
          payments: true
        },
        orderBy: { createdAt: "desc" },
        take: 300
      });

      return ok({ orders });
    }

    if (auth.role === "VENDOR") {
      const orders = await prisma.order.findMany({
        where: {
          items: {
            some: {
              product: {
                vendorId: auth.id
              }
            }
          }
        },
        include: {
          items: {
            where: {
              product: {
                vendorId: auth.id
              }
            }
          },
          user: { select: { id: true, name: true, email: true } },
          payments: true
        },
        orderBy: { createdAt: "desc" },
        take: 300
      });

      return ok({ orders });
    }
  }

  const orders = await prisma.order.findMany({
    where: { userId: auth.id },
    include: {
      items: true,
      payments: true
    },
    orderBy: { createdAt: "desc" }
  });

  return ok({ orders });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return fail("Invalid request body", 400);
  }

  const parsed = parseWithSchema(checkoutSchema, body);
  if (parsed.error || !parsed.data) {
    return fail(parsed.error || "Validation failed", 422);
  }

  const payload = parsed.data;
  const session = getSessionUser();
  const normalizedGuestEmail = payload.guestEmail ? payload.guestEmail.trim().toLowerCase() : null;
  if (!session && !normalizedGuestEmail) {
    return fail("Guest email is required", 422);
  }

  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: payload.idempotencyKey },
    include: { items: true, payments: true }
  });
  if (existing) {
    return ok({ order: existing, idempotentReplay: true });
  }

  const products = await prisma.product.findMany({
    where: {
      id: { in: payload.items.map((item) => item.productId) }
    },
    include: {
      variants: true
    }
  });

  if (products.length !== payload.items.length) {
    return fail("One or more products were not found", 404);
  }

  let subtotalCents = 0;
  const lineItems: {
    productId: string;
    variantId?: string;
    name: string;
    sku: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }[] = [];

  for (const requestedItem of payload.items) {
    const product = products.find((entry) => entry.id === requestedItem.productId);
    if (!product) {
      return fail("Product was not found", 404);
    }

    const variant = requestedItem.variantId
      ? product.variants.find((entry) => entry.id === requestedItem.variantId)
      : null;

    if (requestedItem.variantId && !variant) {
      return fail(`Variant not found for ${product.name}`, 404);
    }

    if (product.stockQuantity < requestedItem.quantity) {
      return fail(`Insufficient stock for ${product.name}`, 409);
    }

    if (variant && variant.stockQuantity < requestedItem.quantity) {
      return fail(`Insufficient variant stock for ${product.name}`, 409);
    }

    const basePrice = product.discountPriceCents ?? product.priceCents;
    const unitPriceCents = basePrice + (variant?.priceDeltaCents || 0);
    const lineTotalCents = unitPriceCents * requestedItem.quantity;

    subtotalCents += lineTotalCents;

    lineItems.push({
      productId: product.id,
      variantId: variant?.id,
      name: product.name,
      sku: variant?.sku || product.sku,
      quantity: requestedItem.quantity,
      unitPriceCents,
      lineTotalCents
    });
  }

  const { discountCents, couponId } = await resolveDiscount(subtotalCents, payload.couponCode || undefined);
  const shippingCents = computeShippingCents(payload.shipping.city, payload.shipping.country);
  const taxableBase = Math.max(subtotalCents - discountCents, 0);
  const taxCents = Math.round(taxableBase * TAX_RATE);
  const totalCents = taxableBase + taxCents + shippingCents;

  const paymentMethod = ensurePaymentMethod(payload.paymentMethod);
  const paymentStatus = "INITIATED";

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        userId: session?.id,
        guestEmail: session ? null : normalizedGuestEmail,
        status: "PENDING",
        paymentStatus,
        paymentMethod,
        paymentReference: null,
        idempotencyKey: payload.idempotencyKey,
        subtotalCents,
        taxCents,
        shippingCents,
        totalCents,
        shippingName: payload.shipping.name,
        shippingPhone: payload.shipping.phone,
        shippingLine1: payload.shipping.line1,
        shippingLine2: payload.shipping.line2 || null,
        shippingCity: payload.shipping.city,
        shippingState: payload.shipping.state,
        shippingPostalCode: payload.shipping.postalCode,
        shippingCountry: payload.shipping.country,
        notes: couponId ? `coupon:${payload.couponCode}` : null,
        items: {
          create: lineItems.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            lineTotalCents: item.lineTotalCents
          }))
        }
      },
      include: {
        items: true
      }
    });

    await tx.payment.create({
      data: {
        orderId: order.id,
        provider: paymentMethod === "MPESA" ? "M-Pesa" : "MockGateway",
        providerRef: `pay_${randomUUID()}`,
        method: paymentMethod,
        amountCents: totalCents,
        status: "INITIATED"
      }
    });

    for (const item of lineItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stockQuantity: {
            decrement: item.quantity
          }
        }
      });

      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            stockQuantity: {
              decrement: item.quantity
            }
          }
        });
      }

      await tx.inventoryLog.create({
        data: {
          productId: item.productId,
          orderId: order.id,
          change: -item.quantity,
          reason: "order_checkout"
        }
      });
    }

    if (couponId) {
      await tx.coupon.update({
        where: { id: couponId },
        data: {
          usedCount: {
            increment: 1
          }
        }
      });
    }

    if (session) {
      await tx.cartItem.deleteMany({ where: { userId: session.id } });
    }

    return order;
  });

  try {
    await emitOrderPlaced({
      orderId: result.id,
      actorUserId: session?.id || null,
      actorRole: session?.role || "USER"
    });
  } catch (error) {
    console.error("emitOrderPlaced failed", error);
  }

  return ok({
    order: result,
    pricing: {
      subtotalCents,
      discountCents,
      taxCents,
      shippingCents,
      totalCents
    }
  }, 201);
}
