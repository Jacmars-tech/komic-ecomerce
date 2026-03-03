import * as admin from "firebase-admin";

import { requireAdminDb } from "@/lib/firebase-admin";

export type ChatThreadStatus = "open" | "resolved";
export type ChatSenderRole = "user" | "admin" | "vendor";

export type ChatThreadView = {
  threadId: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: ChatThreadStatus;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  unreadUserCount: number;
  unreadAdminCount: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ChatMessageView = {
  id: string;
  senderUserId: string | null;
  senderRole: ChatSenderRole;
  text: string;
  createdAt: string | null;
};

function timestampToIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return null;
}

function normalizeThread(threadId: string, data: Record<string, unknown> | undefined): ChatThreadView {
  return {
    threadId,
    userId: (data?.userId as string) || "",
    userName: (data?.userName as string) || "Customer",
    userEmail: (data?.userEmail as string) || "",
    status: ((data?.status as ChatThreadStatus) || "open") as ChatThreadStatus,
    lastMessageAt: timestampToIso(data?.lastMessageAt),
    lastMessagePreview: (data?.lastMessagePreview as string) || "",
    unreadUserCount: Number(data?.unreadUserCount || 0),
    unreadAdminCount: Number(data?.unreadAdminCount || 0),
    createdAt: timestampToIso(data?.createdAt),
    updatedAt: timestampToIso(data?.updatedAt)
  };
}

export function buildThreadId(userId: string) {
  return `thread_${userId}`;
}

export async function ensureThreadForUser(input: {
  userId: string;
  userName: string;
  userEmail: string;
}) {
  const db = requireAdminDb();
  const threadId = buildThreadId(input.userId);
  const ref = db.collection("chatThreads").doc(threadId);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    await ref.set({
      threadId,
      userId: input.userId,
      userName: input.userName,
      userEmail: input.userEmail,
      status: "open",
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      lastMessagePreview: "",
      unreadUserCount: 0,
      unreadAdminCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } else {
    await ref.set(
      {
        userName: input.userName,
        userEmail: input.userEmail,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }

  const latest = await ref.get();
  return normalizeThread(threadId, latest.data() as Record<string, unknown> | undefined);
}

export async function getThread(threadId: string) {
  const db = requireAdminDb();
  const ref = db.collection("chatThreads").doc(threadId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  return normalizeThread(threadId, snapshot.data() as Record<string, unknown> | undefined);
}

export async function setThreadReadState(threadId: string, role: "user" | "admin") {
  const db = requireAdminDb();
  const ref = db.collection("chatThreads").doc(threadId);

  const data: Record<string, unknown> = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  if (role === "user") {
    data.unreadUserCount = 0;
  } else {
    data.unreadAdminCount = 0;
  }

  await ref.set(data, { merge: true });
}

export async function addThreadMessage(input: {
  threadId: string;
  senderUserId?: string | null;
  senderRole: ChatSenderRole;
  text: string;
}) {
  const db = requireAdminDb();
  const threadRef = db.collection("chatThreads").doc(input.threadId);
  const snapshot = await threadRef.get();

  if (!snapshot.exists) {
    throw new Error("Chat thread not found");
  }

  const preview = input.text.trim().slice(0, 160);
  await threadRef.collection("messages").add({
    senderUserId: input.senderUserId || null,
    senderRole: input.senderRole,
    text: input.text.trim(),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const nextMeta: Record<string, unknown> = {
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
    lastMessagePreview: preview,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    status: "open"
  };

  if (input.senderRole === "user") {
    nextMeta.unreadAdminCount = admin.firestore.FieldValue.increment(1);
  } else {
    nextMeta.unreadUserCount = admin.firestore.FieldValue.increment(1);
  }

  await threadRef.set(nextMeta, { merge: true });
}

export async function listThreads(limit = 200) {
  const db = requireAdminDb();

  let snapshot: admin.firestore.QuerySnapshot;
  try {
    snapshot = await db
      .collection("chatThreads")
      .orderBy("lastMessageAt", "desc")
      .limit(limit)
      .get();
  } catch {
    snapshot = await db.collection("chatThreads").limit(limit).get();
  }

  return snapshot.docs.map((doc) =>
    normalizeThread(doc.id, doc.data() as Record<string, unknown> | undefined)
  );
}

export async function listThreadMessages(threadId: string, limit = 300) {
  const db = requireAdminDb();
  const snapshot = await db
    .collection("chatThreads")
    .doc(threadId)
    .collection("messages")
    .orderBy("createdAt", "asc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      senderUserId: (data.senderUserId as string) || null,
      senderRole: ((data.senderRole as ChatSenderRole) || "admin") as ChatSenderRole,
      text: (data.text as string) || "",
      createdAt: timestampToIso(data.createdAt)
    } as ChatMessageView;
  });
}
