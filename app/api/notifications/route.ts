import { NextRequest } from "next/server";

import { isErrorResponse, ok, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = requireAuth();
  if (isErrorResponse(auth)) {
    return auth;
  }

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");
  const take = Math.min(Number(searchParams.get("take") || "200"), 500);

  const notifications = await prisma.notification.findMany({
    where:
      auth.role === "ADMIN" && scope === "all"
        ? undefined
        : { userId: auth.id },
    include: {
      order: {
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          totalCents: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take
  });

  return ok({ notifications });
}
