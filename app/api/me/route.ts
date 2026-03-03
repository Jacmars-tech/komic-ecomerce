import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, isErrorResponse, ok, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const profileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  phone: z.string().min(8).max(20).optional().nullable(),
  twoFactorEnabled: z.boolean().optional(),
  addresses: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().min(2).max(40),
        line1: z.string().min(2),
        line2: z.string().optional().nullable(),
        city: z.string().min(2),
        state: z.string().min(2),
        postalCode: z.string().min(2),
        country: z.string().min(2),
        isDefault: z.boolean().optional()
      })
    )
    .optional()
});

export async function GET() {
  const auth = requireAuth();
  if (isErrorResponse(auth)) {
    return auth;
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    include: {
      addresses: { orderBy: { createdAt: "asc" } },
      orders: {
        select: { id: true, createdAt: true, status: true, totalCents: true },
        orderBy: { createdAt: "desc" },
        take: 10
      }
    }
  });

  if (!user) {
    return fail("User not found", 404);
  }

  return ok({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      addresses: user.addresses || [],
      recentOrders: user.orders || []
    }
  });
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

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const data = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: auth.id },
      data: {
        name: data.name,
        phone: data.phone ?? undefined,
        twoFactorEnabled: data.twoFactorEnabled
      }
    });

    if (data.addresses) {
      await tx.address.deleteMany({ where: { userId: auth.id } });
      if (data.addresses.length > 0) {
        await tx.address.createMany({
          data: data.addresses.map((address, index) => ({
            userId: auth.id,
            label: address.label,
            line1: address.line1,
            line2: address.line2 || null,
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
            country: address.country,
            isDefault: Boolean(address.isDefault) || index === 0
          }))
        });
      }
    }
  });

  return ok({ message: "Profile updated" });
}

export async function DELETE() {
  const auth = requireAuth();
  if (isErrorResponse(auth)) {
    return auth;
  }

  await prisma.user.delete({ where: { id: auth.id } });
  return ok({ message: "Account deleted" });
}
