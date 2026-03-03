export type ClientCartItem = {
  productId: string;
  variantId?: string | null;
  name: string;
  sku: string;
  priceCents: number;
  quantity: number;
  stockQuantity?: number;
  imageUrl?: string;
};

type WriteResult = {
  ok: boolean;
  persistence: "localStorage" | "memory" | "none";
};

const STORAGE_KEY = "shop_cart_v1";
const MEMORY_KEY = "__SHOP_CART_MEMORY__";

declare global {
  interface Window {
    __SHOP_CART_MEMORY__?: ClientCartItem[];
  }
}

function normalizeItem(value: unknown): ClientCartItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Record<string, unknown>;
  if (typeof item.productId !== "string" || typeof item.name !== "string" || typeof item.sku !== "string") {
    return null;
  }

  const priceCents = Number(item.priceCents);
  const quantity = Number(item.quantity);

  if (!Number.isFinite(priceCents) || !Number.isFinite(quantity)) {
    return null;
  }

  const stockQuantityRaw = item.stockQuantity;
  const stockQuantity =
    typeof stockQuantityRaw === "number" && Number.isFinite(stockQuantityRaw) ? Math.max(0, stockQuantityRaw) : undefined;

  return {
    productId: item.productId,
    variantId: typeof item.variantId === "string" ? item.variantId : null,
    name: item.name,
    sku: item.sku,
    priceCents: Math.max(0, Math.round(priceCents)),
    quantity: Math.max(1, Math.round(quantity)),
    stockQuantity,
    imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : undefined
  };
}

function normalizeCartPayload(value: unknown): ClientCartItem[] {
  let source = value;
  if (source && typeof source === "object" && Array.isArray((source as { items?: unknown[] }).items)) {
    source = (source as { items: unknown[] }).items;
  }

  if (!Array.isArray(source)) {
    return [];
  }

  return source.map(normalizeItem).filter(Boolean) as ClientCartItem[];
}

function emitCartUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("cart:updated"));
  }
}

export function readCart(): ClientCartItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const normalized = normalizeCartPayload(parsed);

    // Self-heal broken payloads from old versions.
    if (raw && JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }

    if (normalized.length > 0 || !window[MEMORY_KEY] || window[MEMORY_KEY]!.length === 0) {
      return normalized;
    }
  } catch {
    // Fallback to memory cart when storage is unavailable.
  }

  return normalizeCartPayload(window[MEMORY_KEY] || []);
}

export function writeCart(items: ClientCartItem[]): WriteResult {
  if (typeof window === "undefined") {
    return { ok: false, persistence: "none" };
  }

  const normalized = normalizeCartPayload(items);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window[MEMORY_KEY] = normalized;
    emitCartUpdated();
    return { ok: true, persistence: "localStorage" };
  } catch {
    try {
      window[MEMORY_KEY] = normalized;
      emitCartUpdated();
      return { ok: true, persistence: "memory" };
    } catch {
      return { ok: false, persistence: "none" };
    }
  }
}

export function clearCart(): WriteResult {
  if (typeof window === "undefined") {
    return { ok: false, persistence: "none" };
  }

  window[MEMORY_KEY] = [];

  try {
    localStorage.removeItem(STORAGE_KEY);
    emitCartUpdated();
    return { ok: true, persistence: "localStorage" };
  } catch {
    emitCartUpdated();
    return { ok: true, persistence: "memory" };
  }
}
