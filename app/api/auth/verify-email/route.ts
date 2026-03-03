import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  token: z.string().min(20)
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return fail(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const user = await prisma.user.findFirst({
    where: {
      verificationToken: parsed.data.token,
      verificationExpiresAt: {
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
      isVerified: true,
      verificationToken: null,
      verificationExpiresAt: null
    }
  });

  return ok({ message: "Email verified successfully" });
}
