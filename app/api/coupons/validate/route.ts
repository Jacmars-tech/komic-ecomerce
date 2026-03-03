import { NextRequest } from "next/server";

import { fail, ok, parseWithSchema } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { couponSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return fail("Invalid request body", 400);
  }

  const parsed = parseWithSchema(couponSchema, body);
  if (parsed.error || !parsed.data) {
    return fail(parsed.error || "Validation failed", 422);
  }

  const code = parsed.data.code.toUpperCase().trim();

  const coupon = await prisma.coupon.findUnique({
    where: { code }
  });

  if (!coupon || !coupon.active) {
    return fail("Coupon is invalid", 404);
  }

  const now = new Date();
  if ((coupon.startsAt && coupon.startsAt > now) || (coupon.endsAt && coupon.endsAt < now)) {
    return fail("Coupon is not active for this date", 400);
  }

  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    return fail("Coupon usage limit reached", 400);
  }

  return ok({
    coupon: {
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minimumOrderCents: coupon.minimumOrderCents
    }
  });
}
