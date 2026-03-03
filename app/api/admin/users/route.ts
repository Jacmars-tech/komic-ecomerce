import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, isErrorResponse, ok, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  userId: z.string().min(5),
  role: z.enum(["USER", "VENDOR", "ADMIN"]).optional(),
  isVerified: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional()
});

export async function GET() {
  const auth = requireRole(["ADMIN"]);
  if (isErrorResponse(auth)) {
    return auth;
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" }
  });

  return ok({
    users: users.map((user: any) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      role: user.role,
      isVerified: Boolean(user.isVerified),
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
      createdAt: user.createdAt
    }))
  });
}

export async function PATCH(req: NextRequest) {
  const auth = requireRole(["ADMIN"]);
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

  const payload = parsed.data;
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    return fail("User not found", 404);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      role: payload.role,
      isVerified: payload.isVerified,
      twoFactorEnabled: payload.twoFactorEnabled
    }
  });

  return ok({
    user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      isVerified: Boolean(updated.isVerified),
      twoFactorEnabled: Boolean(updated.twoFactorEnabled)
    }
  });
}

