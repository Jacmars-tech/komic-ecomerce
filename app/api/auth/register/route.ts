import { NextRequest } from "next/server";

import { ok, fail, parseWithSchema } from "@/lib/api";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators";
import { setSessionCookie, signSessionToken } from "@/lib/auth";

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

  const parsed = parseWithSchema(registerSchema, body);
  if (parsed.error || !parsed.data) {
    return fail(parsed.error || "Validation failed", 422);
  }

  const email = parsed.data.email.toLowerCase();
  const phone = normalizePhone(parsed.data.phone.trim());

  const exists = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { phone }]
    }
  });

  if (exists) {
    return fail("Email or phone already in use", 409);
  }

  const user = await prisma.user.create({
    data: {
      email,
      phone: phone || null,
      name: parsed.data.name,
      passwordHash: hashPassword(parsed.data.password),
      role: "USER",
      isVerified: false
    }
  });

  const token = signSessionToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as "USER" | "ADMIN" | "VENDOR"
  });

  setSessionCookie(token);

  return ok(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified
      },
      message: "Registered successfully"
    },
    201
  );
}
