import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, isErrorResponse, ok, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  status: z.enum(["PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]).optional(),
  paymentStatus: z.enum(["INITIATED", "VERIFIED", "FAILED", "REFUNDED"]).optional(),
  paymentReference: z.string().max(120).optional().nullable(),
  refund: z.boolean().optional()
});

export async function GET(_: NextRequest, context: { params: { id: string } }) {
  const auth = requireAuth();
  if (isErrorResponse(auth)) {
    return auth;
  }

  const order = await prisma.order.findUnique({
    where: { id: context.params.id },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              vendorId: true
            }
          }
        }
      },
      payments: true,
      user: {
        select: { id: true, name: true, email: true }
      }
    }
  });

  if (!order) {
    return fail("Order not found", 404);
  }

  if (auth.role !== "ADMIN") {
    if (auth.role === "VENDOR") {
      const hasOwnedProduct = order.items.some((item) => item.product.vendorId === auth.id);
      if (!hasOwnedProduct) {
        return fail("Forbidden", 403);
      }
    } else if (order.userId !== auth.id) {
      return fail("Forbidden", 403);
    }
  }

  const scopedOrder =
    auth.role === "VENDOR"
      ? {
          ...order,
          items: order.items.filter((item) => item.product.vendorId === auth.id)
        }
      : order;

  return ok({ order: scopedOrder });
}

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  const auth = requireAuth();
  if (isErrorResponse(auth)) {
    return auth;
  }

  if (auth.role !== "ADMIN") {
    return fail("Forbidden", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return fail("Invalid request body", 400);
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const order = await prisma.order.findUnique({
    where: { id: context.params.id },
    include: { payments: true }
  });

  if (!order) {
    return fail("Order not found", 404);
  }

  const payload = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.order.update({
      where: { id: order.id },
      data: {
        status: payload.status,
        paymentStatus: payload.paymentStatus,
        paymentReference: payload.paymentReference
      },
      include: {
        items: true,
        payments: true
      }
    });

    if (payload.refund) {
      await tx.payment.create({
        data: {
          orderId: order.id,
          provider: "manual_refund",
          method: order.paymentMethod,
          amountCents: order.totalCents,
          status: "REFUNDED",
          providerRef: `refund_${order.id}`
        }
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "REFUNDED",
          paymentStatus: "REFUNDED"
        }
      });
    }

    return next;
  });

  return ok({ order: updated });
}
