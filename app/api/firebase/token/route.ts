import { fail, isErrorResponse, ok, requireAuth } from "@/lib/api";
import { hasAdminCreds, requireAdminAuth } from "@/lib/firebase-admin";

export async function GET() {
  const session = requireAuth();
  if (isErrorResponse(session)) {
    return session;
  }

  if (!hasAdminCreds) {
    return fail("Firebase admin credentials missing", 503);
  }

  try {
    const auth = requireAdminAuth();
    const token = await auth.createCustomToken(session.id, {
      role: session.role,
      appUserId: session.id
    });
    return ok({
      token,
      uid: session.id,
      role: session.role
    });
  } catch (error) {
    console.error("firebase custom token error", error);
    return fail("Unable to create firebase token", 500);
  }
}
