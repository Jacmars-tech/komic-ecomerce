import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  orderId: z.string().min(5),
  guestEmail: z.string().email().optional()
});

export async function POST(req: NextRequest) {
  const session = getSessionUser();

  const body = await req.json().catch(() => null);
  if (!body) {
    return fail("Invalid request body", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    include: { payments: true }
  });

  if (!order) {
    return fail("Order not found", 404);
  }

  if (session) {
    if (session.role !== "ADMIN" && order.userId !== session.id) {
      return fail("Forbidden", 403);
    }
  } else {
    const email = parsed.data.guestEmail?.trim().toLowerCase();
    if (order.userId) {
      return fail("Unauthorized", 401);
    }
    if (order.guestEmail && (!email || order.guestEmail.toLowerCase() !== email)) {
      return fail("Forbidden", 403);
    }
  }

  if (order.paymentStatus === "VERIFIED") {
    return ok({ message: "Order already paid", orderId: order.id });
  }

  const providerRef = `intent_${randomUUID()}`;

  const existingInitiated = order.payments.find((entry) => entry.status === "INITIATED");
  const payment = existingInitiated
    ? await prisma.payment.update({
        where: { id: existingInitiated.id },
        data: {
          provider: order.paymentMethod === "MPESA" ? "M-Pesa" : "MockGateway",
          providerRef,
          method: order.paymentMethod,
          amountCents: order.totalCents
        }
      })
    : await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: order.paymentMethod === "MPESA" ? "M-Pesa" : "MockGateway",
          providerRef,
          method: order.paymentMethod,
          amountCents: order.totalCents,
          status: "INITIATED"
        }
      });

  return ok({
    orderId: order.id,
    providerRef,
    paymentId: payment.id,
    clientSecret: `mock_secret_${providerRef}`,
    message:
      order.paymentMethod === "MPESA"
        ? "Simulated M-Pesa STK push initiated"
        : "Payment intent created"
  });
}
