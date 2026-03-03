import { fail, isErrorResponse, ok, requireAuth } from "@/lib/api";
import { ensureThreadForUser, setThreadReadState } from "@/lib/chat-server";
import { hasAdminCreds } from "@/lib/firebase-admin";

export async function GET() {
  const auth = requireAuth();
  if (isErrorResponse(auth)) {
    return auth;
  }

  if (!hasAdminCreds) {
    return fail("Chat service is not configured", 503);
  }

  try {
    const thread = await ensureThreadForUser({
      userId: auth.id,
      userName: auth.name,
      userEmail: auth.email
    });

    await setThreadReadState(thread.threadId, "user");
    return ok({ thread });
  } catch (error) {
    console.error("chat thread error", error);
    return fail("Unable to initialize chat thread", 500);
  }
}

