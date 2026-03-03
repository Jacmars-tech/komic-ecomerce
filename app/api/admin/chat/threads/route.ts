import { fail, isErrorResponse, ok, requireRole } from "@/lib/api";
import { listThreads } from "@/lib/chat-server";
import { getVendorAccessibleUserIds } from "@/lib/events";
import { hasAdminCreds } from "@/lib/firebase-admin";

export async function GET() {
  const auth = requireRole(["ADMIN", "VENDOR"]);
  if (isErrorResponse(auth)) {
    return auth;
  }

  if (!hasAdminCreds) {
    return fail("Chat service is not configured", 503);
  }

  try {
    const threads = await listThreads(300);

    if (auth.role === "ADMIN") {
      return ok({ threads });
    }

    const allowedUserIds = new Set(await getVendorAccessibleUserIds(auth.id));
    const scoped = threads.filter((thread) => allowedUserIds.has(thread.userId));
    return ok({ threads: scoped });
  } catch (error) {
    console.error("admin chat threads error", error);
    return fail("Unable to load chat threads", 500);
  }
}

