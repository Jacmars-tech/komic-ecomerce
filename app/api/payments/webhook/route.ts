import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api";
import { emitPaymentUpdated } from "@/lib/events";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  type: z.enum(["payment.succeeded", "payment.failed"]),
  orderId: z.string().min(5),
  providerRef: z.string().min(3),
  payload: z.record(z.any()).optional()
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return fail("Invalid webhook body", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const event = parsed.data;

  const order = await prisma.order.findUnique({
    where: { id: event.orderId },
    include: {
      items: true,
      payments: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!order) {
    return fail("Order not found", 404);
  }

  const payment =
    order.payments.find((entry) => entry.providerRef === event.providerRef) ||
    order.payments.find((entry) => entry.status === "INITIATED") ||
    order.payments[0];

  if (!payment) {
    return fail("Payment record not found", 404);
  }

  const success = event.type === "payment.succeeded";
  const shouldRestock =
    !success &&
    order.paymentStatus !== "FAILED" &&
    order.paymentStatus !== "REFUNDED" &&
    order.paymentStatus !== "VERIFIED";

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        providerRef: event.providerRef,
        status: success ? "VERIFIED" : "FAILED",
        webhookPayload: event.payload ? JSON.stringify(event.payload) : null
      }
    });

    await tx.order.update({
      where: { id: event.orderId },
      data: {
        paymentStatus: success ? "VERIFIED" : "FAILED",
        status: success ? "PAID" : "CANCELLED",
        paymentReference: event.providerRef
      }
    });

    if (shouldRestock) {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: {
              increment: item.quantity
            }
          }
        });

        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              stockQuantity: {
                increment: item.quantity
              }
            }
          });
        }

        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            orderId: order.id,
            change: item.quantity,
            reason: "payment_failed_restock"
          }
        });
      }
    }
  });

  try {
    await emitPaymentUpdated({
      orderId: order.id,
      paymentId: payment.id,
      providerRef: event.providerRef,
      success
    });
  } catch (error) {
    console.error("emitPaymentUpdated failed", error);
  }

  return ok({ received: true, success });
}
