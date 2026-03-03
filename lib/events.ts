import { prisma } from "@/lib/prisma";

type AuditEntityType = "ORDER" | "PAYMENT" | "CHAT_THREAD";
type ActorRole = "USER" | "ADMIN" | "VENDOR" | null;

type NotificationInput = {
  recipients: string[];
  orderId?: string | null;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  roleTarget?: "USER" | "ADMIN" | "VENDOR" | null;
};

type AuditInput = {
  actorUserId?: string | null;
  actorRole?: ActorRole;
  eventType: string;
  entityType: AuditEntityType;
  entityId?: string | null;
  orderId?: string | null;
  payload?: Record<string, unknown>;
};

function toJson(value: unknown): string | null {
  if (value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function unique(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

async function getAdminUserIds() {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true }
  });
  return admins.map((user) => user.id);
}

async function getVendorIdsForOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      items: {
        select: {
          product: {
            select: {
              vendorId: true
            }
          }
        }
      }
    }
  });

  if (!order) return [];
  return unique(order.items.map((item) => item.product.vendorId));
}

async function getVendorIdsForUser(userId?: string | null) {
  if (!userId) return [];

  const orders = await prisma.order.findMany({
    where: { userId },
    select: {
      items: {
        select: {
          product: {
            select: {
              vendorId: true
            }
          }
        }
      }
    }
  });

  const vendorIds: string[] = [];
  for (const order of orders) {
    for (const item of order.items) {
      if (item.product.vendorId) {
        vendorIds.push(item.product.vendorId);
      }
    }
  }

  return unique(vendorIds);
}

async function createNotifications(input: NotificationInput) {
  if (input.recipients.length === 0) return;

  await prisma.notification.createMany({
    data: input.recipients.map((userId) => ({
      userId,
      orderId: input.orderId || null,
      roleTarget: input.roleTarget || null,
      channel: "IN_APP",
      type: input.type,
      title: input.title,
      message: input.message,
      status: "SENT",
      metadata: toJson(input.metadata)
    }))
  });
}

async function createAuditLog(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId || null,
      actorRole: input.actorRole || null,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId || null,
      orderId: input.orderId || null,
      payload: toJson(input.payload)
    }
  });
}

export async function emitOrderPlaced(input: {
  orderId: string;
  actorUserId?: string | null;
  actorRole?: ActorRole;
}) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      totalCents: true,
      paymentMethod: true,
      userId: true
    }
  });

  if (!order) return;

  const [adminIds, vendorIds] = await Promise.all([getAdminUserIds(), getVendorIdsForOrder(order.id)]);
  const orderCode = order.id.slice(0, 8).toUpperCase();
  const message = `Order ${orderCode} was placed for ${(order.totalCents / 100).toFixed(2)} KES via ${order.paymentMethod}.`;

  await Promise.all([
    createNotifications({
      recipients: adminIds,
      orderId: order.id,
      type: "ORDER_PLACED",
      title: "New order placed",
      message,
      roleTarget: "ADMIN",
      metadata: { orderId: order.id, totalCents: order.totalCents, paymentMethod: order.paymentMethod }
    }),
    createNotifications({
      recipients: vendorIds,
      orderId: order.id,
      type: "ORDER_PLACED",
      title: "A product you own was ordered",
      message,
      roleTarget: "VENDOR",
      metadata: { orderId: order.id, totalCents: order.totalCents, paymentMethod: order.paymentMethod }
    }),
    createAuditLog({
      actorUserId: input.actorUserId,
      actorRole: input.actorRole || "USER",
      eventType: "ORDER_PLACED",
      entityType: "ORDER",
      entityId: order.id,
      orderId: order.id,
      payload: {
        userId: order.userId,
        totalCents: order.totalCents,
        paymentMethod: order.paymentMethod
      }
    })
  ]);
}

export async function emitPaymentUpdated(input: {
  orderId: string;
  paymentId?: string | null;
  providerRef?: string | null;
  success: boolean;
  actorUserId?: string | null;
  actorRole?: ActorRole;
}) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      totalCents: true,
      userId: true
    }
  });

  if (!order) return;

  const [adminIds, vendorIds] = await Promise.all([getAdminUserIds(), getVendorIdsForOrder(order.id)]);
  const status = input.success ? "VERIFIED" : "FAILED";
  const eventType = input.success ? "PAYMENT_VERIFIED" : "PAYMENT_FAILED";
  const message = input.success
    ? `Payment verified for order ${order.id.slice(0, 8).toUpperCase()}.`
    : `Payment failed for order ${order.id.slice(0, 8).toUpperCase()}.`;

  await Promise.all([
    createNotifications({
      recipients: adminIds,
      orderId: order.id,
      type: eventType,
      title: "Payment update",
      message,
      roleTarget: "ADMIN",
      metadata: { orderId: order.id, paymentId: input.paymentId, providerRef: input.providerRef, status }
    }),
    createNotifications({
      recipients: vendorIds,
      orderId: order.id,
      type: eventType,
      title: "Order payment update",
      message,
      roleTarget: "VENDOR",
      metadata: { orderId: order.id, paymentId: input.paymentId, providerRef: input.providerRef, status }
    }),
    createAuditLog({
      actorUserId: input.actorUserId || null,
      actorRole: input.actorRole || "USER",
      eventType: "PAYMENT_UPDATED",
      entityType: "PAYMENT",
      entityId: input.paymentId || null,
      orderId: order.id,
      payload: {
        providerRef: input.providerRef,
        status,
        success: input.success
      }
    })
  ]);
}

export async function emitChatMessage(input: {
  threadId: string;
  threadUserId: string;
  senderUserId?: string | null;
  senderRole: "USER" | "ADMIN" | "VENDOR";
  text: string;
}) {
  const admins = await getAdminUserIds();
  const vendorsForUser = await getVendorIdsForUser(input.threadUserId);

  let recipients: string[] = [];
  let roleTarget: "USER" | "ADMIN" | "VENDOR" | null = null;
  let type = "CHAT_MESSAGE";
  let title = "Chat message";

  if (input.senderRole === "USER") {
    recipients = unique([...admins, ...vendorsForUser]);
    roleTarget = null;
    type = "CHAT_USER_MESSAGE";
    title = "New support chat message";
  } else if (input.senderRole === "VENDOR") {
    recipients = unique([input.threadUserId, ...admins]);
    roleTarget = null;
    type = "CHAT_VENDOR_REPLY";
    title = "Vendor replied in support chat";
  } else {
    recipients = [input.threadUserId];
    roleTarget = "USER";
    type = "CHAT_ADMIN_REPLY";
    title = "Support replied to your message";
  }

  const preview = input.text.trim().slice(0, 140);

  await Promise.all([
    createNotifications({
      recipients,
      type,
      title,
      message: preview.length > 0 ? preview : "New chat activity.",
      roleTarget,
      metadata: {
        threadId: input.threadId,
        senderRole: input.senderRole,
        senderUserId: input.senderUserId || null
      }
    }),
    createAuditLog({
      actorUserId: input.senderUserId || null,
      actorRole: input.senderRole,
      eventType: "CHAT_MESSAGE",
      entityType: "CHAT_THREAD",
      entityId: input.threadId,
      payload: {
        threadUserId: input.threadUserId,
        textPreview: preview
      }
    })
  ]);
}

export async function getVendorAccessibleUserIds(vendorId: string) {
  const orders = await prisma.order.findMany({
    where: {
      items: {
        some: {
          product: {
            vendorId
          }
        }
      }
    },
    select: {
      userId: true
    }
  });

  return unique(orders.map((order) => order.userId));
}
