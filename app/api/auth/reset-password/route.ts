import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(128)
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return fail(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const user = await prisma.user.findFirst({
    where: {
      resetToken: parsed.data.token,
      resetTokenExpiresAt: {
        gt: new Date()
      }
    }
  });

  if (!user) {
    return fail("Invalid or expired token", 400);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashPassword(parsed.data.password),
      resetToken: null,
      resetTokenExpiresAt: null
    }
  });

  return ok({ message: "Password reset successful" });
}
