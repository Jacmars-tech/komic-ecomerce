import { NextRequest } from "next/server";

import { isErrorResponse, ok, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = requireRole(["ADMIN"]);
  if (isErrorResponse(auth)) {
    return auth;
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const orderId = searchParams.get("orderId");
  const actorRole = searchParams.get("actorRole");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const take = Math.min(Number(searchParams.get("take") || "300"), 1000);

  const createdAt: { gte?: Date; lte?: Date } = {};
  if (from) {
    const parsed = new Date(from);
    if (!Number.isNaN(parsed.getTime())) {
      createdAt.gte = parsed;
    }
  }
  if (to) {
    const parsed = new Date(to);
    if (!Number.isNaN(parsed.getTime())) {
      createdAt.lte = parsed;
    }
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      eventType: type || undefined,
      orderId: orderId || undefined,
      actorRole: actorRole || undefined,
      createdAt: Object.keys(createdAt).length > 0 ? createdAt : undefined
    },
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      },
      order: {
        select: {
          id: true,
          status: true,
          paymentStatus: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take
  });

  return ok({ logs });
}

