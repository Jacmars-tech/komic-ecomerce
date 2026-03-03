import { NextResponse } from "next/server";
import { ZodSchema } from "zod";

import { getSessionUser, SessionUser, UserRole } from "@/lib/auth";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function parseWithSchema<T>(schema: ZodSchema<T>, input: unknown): { data?: T; error?: string } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(", ") };
  }
  return { data: parsed.data };
}

export function requireAuth(): SessionUser | NextResponse {
  const sessionUser = getSessionUser();
  if (!sessionUser) {
    return fail("Unauthorized", 401);
  }
  return sessionUser;
}

export function requireRole(roles: UserRole[]): SessionUser | NextResponse {
  const sessionUser = getSessionUser();
  if (!sessionUser) {
    return fail("Unauthorized", 401);
  }
  if (!roles.includes(sessionUser.role)) {
    return fail("Forbidden", 403);
  }
  return sessionUser;
}

export function isErrorResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
