import crypto from "crypto";
import { NextRequest } from "next/server";
import { z } from "zod";

import { ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email()
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return ok({ message: "If the email exists, reset instructions were sent." });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });

  if (!user) {
    return ok({ message: "If the email exists, reset instructions were sent." });
  }

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: token,
      resetTokenExpiresAt: expiresAt
    }
  });

  return ok({
    message: "If the email exists, reset instructions were sent.",
    devResetToken: process.env.NODE_ENV === "development" ? token : undefined
  });
}
