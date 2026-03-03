import { NextRequest } from "next/server";

import { ok, fail, parseWithSchema } from "@/lib/api";
import { setSessionCookie, signSessionToken } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validators";

function normalizePhone(value: string): string {
  const cleaned = value.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("254")) return `+${cleaned}`;
  if (cleaned.startsWith("0") && cleaned.length === 10) return `+254${cleaned.slice(1)}`;
  return cleaned;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return fail("Invalid request body", 400);
  }

  const parsed = parseWithSchema(loginSchema, body);
  if (parsed.error || !parsed.data) {
    return fail(parsed.error || "Validation failed", 422);
  }

  const identifier = parsed.data.identifier.trim();
  const loweredIdentifier = identifier.toLowerCase();
  const normalizedPhone = normalizePhone(identifier);

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: loweredIdentifier },
        { phone: identifier },
        { phone: normalizedPhone }
      ]
    }
  });

  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return fail("Invalid email or password", 401);
  }

  const token = signSessionToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as "USER" | "ADMIN" | "VENDOR"
  });

  setSessionCookie(token);

  return ok({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isVerified: user.isVerified
    },
    message: "Logged in"
  });
}
