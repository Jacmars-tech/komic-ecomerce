import { NextRequest } from "next/server";

import { fail, isErrorResponse, ok, requireRole } from "@/lib/api";
import { getThread, listThreadMessages, setThreadReadState } from "@/lib/chat-server";
import { getVendorAccessibleUserIds } from "@/lib/events";
import { hasAdminCreds } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const auth = requireRole(["ADMIN", "VENDOR"]);
  if (isErrorResponse(auth)) {
    return auth;
  }

  if (!hasAdminCreds) {
    return fail("Chat service is not configured", 503);
  }

  const { searchParams } = new URL(req.url);
  const threadId = searchParams.get("threadId");
  if (!threadId) {
    return fail("threadId is required", 422);
  }

  const thread = await getThread(threadId);
  if (!thread) {
    return fail("Chat thread not found", 404);
  }

  if (auth.role === "VENDOR") {
    const allowedUserIds = new Set(await getVendorAccessibleUserIds(auth.id));
    if (!allowedUserIds.has(thread.userId)) {
      return fail("Forbidden", 403);
    }
  }

  try {
    const messages = await listThreadMessages(threadId, 400);
    await setThreadReadState(threadId, "admin");
    return ok({ thread, messages });
  } catch (error) {
    console.error("admin chat messages error", error);
    return fail("Unable to load chat messages", 500);
  }
}

