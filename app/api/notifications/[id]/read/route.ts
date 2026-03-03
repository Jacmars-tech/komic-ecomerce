import { NextRequest } from "next/server";

import { fail, isErrorResponse, ok, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function PATCH(_: NextRequest, context: { params: { id: string } }) {
  const auth = requireAuth();
  if (isErrorResponse(auth)) {
    return auth;
  }

  const notification = await prisma.notification.findUnique({
    where: { id: context.params.id }
  });

  if (!notification) {
    return fail("Notification not found", 404);
  }

  const canRead =
    auth.role === "ADMIN" ||
    notification.userId === auth.id ||
    (!notification.userId && notification.roleTarget === auth.role);

  if (!canRead) {
    return fail("Forbidden", 403);
  }

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: {
      readAt: new Date(),
      status: "READ"
    }
  });

  return ok({ notification: updated });
}

