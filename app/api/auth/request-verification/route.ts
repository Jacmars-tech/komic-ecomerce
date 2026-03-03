import crypto from "crypto";

import { fail, isErrorResponse, ok, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const auth = requireAuth();
  if (isErrorResponse(auth)) {
    return auth;
  }

  const user = await prisma.user.findUnique({ where: { id: auth.id } });
  if (!user) {
    return fail("User not found", 404);
  }

  if (user.isVerified) {
    return ok({ message: "Email already verified" });
  }

  const token = crypto.randomBytes(24).toString("hex");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      verificationToken: token,
      verificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });

  return ok({
    message: "Verification email requested",
    devVerificationToken: process.env.NODE_ENV === "development" ? token : undefined
  });
}
