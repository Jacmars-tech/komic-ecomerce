export const SHIPPING_RULES = [
  { zone: "Nairobi", flatCents: 50000 },
  { zone: "Rest of Kenya", flatCents: 90000 },
  { zone: "East Africa", flatCents: 180000 }
] as const;

export const LOW_STOCK_THRESHOLD = 5;

export const ORDER_STATUS_FLOW = [
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED"
] as const;

export const PAYMENT_METHODS = ["CARD", "MPESA", "BANK_TRANSFER", "CASH_ON_DELIVERY"] as const;
