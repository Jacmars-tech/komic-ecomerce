import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, isErrorResponse, ok, requireAuth } from "@/lib/api";
import { addThreadMessage, buildThreadId, ensureThreadForUser, getThread } from "@/lib/chat-server";
import { emitChatMessage } from "@/lib/events";
import { hasAdminCreds } from "@/lib/firebase-admin";

const schema = z.object({
  threadId: z.string().min(5),
  text: z.string().min(1).max(2000)
});

export async function POST(req: NextRequest) {
  const auth = requireAuth();
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

  const expectedThreadId = buildThreadId(auth.id);
  if (parsed.data.threadId !== expectedThreadId) {
    return fail("Forbidden", 403);
  }

  try {
    const thread = (await getThread(expectedThreadId)) ||
      (await ensureThreadForUser({
        userId: auth.id,
        userName: auth.name,
        userEmail: auth.email
      }));

    if (thread.userId !== auth.id) {
      return fail("Forbidden", 403);
    }

    const text = parsed.data.text.trim();
    if (!text) {
      return fail("Message cannot be empty", 422);
    }

    await addThreadMessage({
      threadId: expectedThreadId,
      senderUserId: auth.id,
      senderRole: "user",
      text
    });

    await emitChatMessage({
      threadId: expectedThreadId,
      threadUserId: auth.id,
      senderUserId: auth.id,
      senderRole: "USER",
      text
    });

    return ok({ sent: true });
  } catch (error) {
    console.error("chat send error", error);
    return fail("Unable to send chat message", 500);
  }
}

