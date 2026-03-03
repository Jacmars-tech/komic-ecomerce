import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, isErrorResponse, ok, requireRole } from "@/lib/api";
import { addThreadMessage, getThread, setThreadReadState } from "@/lib/chat-server";
import { emitChatMessage, getVendorAccessibleUserIds } from "@/lib/events";
import { hasAdminCreds } from "@/lib/firebase-admin";

const schema = z.object({
  threadId: z.string().min(5),
  text: z.string().min(1).max(2000)
});

export async function POST(req: NextRequest) {
  const auth = requireRole(["ADMIN", "VENDOR"]);
  if (isErrorResponse(auth)) {
    return auth;
  }

  if (!hasAdminCreds) {
    return fail("Chat service is not configured", 503);
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return fail("Invalid request body", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  try {
    const thread = await getThread(parsed.data.threadId);
    if (!thread) {
      return fail("Chat thread not found", 404);
    }

    if (auth.role === "VENDOR") {
      const allowedUserIds = new Set(await getVendorAccessibleUserIds(auth.id));
      if (!allowedUserIds.has(thread.userId)) {
        return fail("Forbidden", 403);
      }
    }

    const text = parsed.data.text.trim();
    if (!text) {
      return fail("Message cannot be empty", 422);
    }

    const senderRole = auth.role === "ADMIN" ? "admin" : "vendor";
    await addThreadMessage({
      threadId: thread.threadId,
      senderUserId: auth.id,
      senderRole,
      text
    });
    await setThreadReadState(thread.threadId, "admin");

    await emitChatMessage({
      threadId: thread.threadId,
      threadUserId: thread.userId,
      senderUserId: auth.id,
      senderRole: auth.role,
      text
    });

    return ok({ sent: true });
  } catch (error) {
    console.error("admin chat send error", error);
    return fail("Unable to send chat message", 500);
  }
}

