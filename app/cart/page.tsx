"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { optimizeImageUrl } from "@/lib/image";
import { readCart, writeCart } from "@/lib/cart-storage";

type CartItem = {
  productId: string;
  variantId?: string | null;
  name: string;
  sku: string;
  priceCents: number;
  quantity: number;
  stockQuantity?: number;
  imageUrl?: string;
};

type ProductLookup = {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  discountPriceCents: number | null;
  stockQuantity: number;
  images?: { url: string }[];
  variants?: { id: string; value: string; stockQuantity: number; priceDeltaCents: number }[];
};

type CouponPayload = {
  code: string;
  description?: string | null;
  discountType: string;
  discountValue: number;
  minimumOrderCents: number;
};

function currency(cents: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: process.env.NEXT_PUBLIC_CURRENCY || "KES"
  }).format(cents / 100);
}

async function reconcileCart(items: CartItem[]): Promise<{ items: CartItem[]; removed: number }> {
  if (items.length === 0) {
    return { items, removed: 0 };
  }

  const response = await fetch("/api/products", { cache: "no-store" });
  if (!response.ok) {
    return { items, removed: 0 };
  }

  const payload = await response.json().catch(() => ({}));
  const products = (payload.products || []) as ProductLookup[];
  const map = new Map(products.map((product) => [product.id, product]));

  const next: CartItem[] = [];
  for (const item of items) {
    const product = map.get(item.productId);
    if (!product) {
      continue;
    }

    const variant = item.variantId ? product.variants?.find((entry) => entry.id === item.variantId) : null;
    if (item.variantId && !variant) {
      continue;
    }

    const availableStock = variant?.stockQuantity ?? product.stockQuantity;
    if (availableStock <= 0) {
      continue;
    }

    const unitPrice = (product.discountPriceCents ?? product.priceCents) + (variant?.priceDeltaCents || 0);
    const safeQty = Math.max(1, Math.min(item.quantity, availableStock));
    const safeSku = variant ? `${product.sku}-${variant.value}` : product.sku;

    next.push({
      productId: product.id,
      variantId: variant?.id || null,
      name: product.name,
      sku: safeSku,
      priceCents: unitPrice,
      quantity: safeQty,
      stockQuantity: availableStock,
      imageUrl: item.imageUrl || product.images?.[0]?.url
    });
  }

  return { items: next, removed: Math.max(0, items.length - next.length) };
}

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<CouponPayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const sync = async () => {
      const current = readCart() as CartItem[];
      const reconciled = await reconcileCart(current);
      setItems(reconciled.items);
      if (reconciled.removed > 0) {
        writeCart(reconciled.items as any);
        setMessage("Some unavailable cart items were removed automatically.");
      }
    };

    sync();
  }, []);

  const subtotalCents = useMemo(
    () => items.reduce((total, item) => total + item.priceCents * item.quantity, 0),
    [items]
  );

  const discountCents = useMemo(() => {
    if (!coupon || subtotalCents < coupon.minimumOrderCents) {
      return 0;
    }
    return coupon.discountType === "percentage"
      ? Math.round((subtotalCents * coupon.discountValue) / 100)
      : coupon.discountValue;
  }, [coupon, subtotalCents]);

  const estimatedShippingCents = subtotalCents > 0 ? 50000 : 0;
  const taxCents = Math.round(Math.max(subtotalCents - discountCents, 0) * Number(process.env.NEXT_PUBLIC_TAX_RATE || 0.16));
  const totalCents = Math.max(subtotalCents - discountCents, 0) + estimatedShippingCents + taxCents;

  const updateQty = (index: number, quantity: number) => {
    const next = [...items];
    const maxStock = next[index].stockQuantity ?? 999;
    next[index] = {
      ...next[index],
      quantity: Math.max(1, Math.min(maxStock, quantity))
    };
    setItems(next);
    if (!writeCart(next).ok) {
      setMessage("Unable to update cart in browser storage.");
    }
  };

  const removeItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    if (!writeCart(next).ok) {
      setMessage("Unable to update cart in browser storage.");
    }
  };

  const applyCoupon = async () => {
    setMessage(null);
    if (!couponInput.trim()) {
      setCoupon(null);
      return;
    }

    const res = await fetch("/api/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: couponInput.trim() })
    });
    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      setCoupon(null);
      setMessage(payload.error || "Coupon not valid");
      return;
    }

    setCoupon(payload.coupon as CouponPayload);
    setMessage("Coupon applied");
  };

  return (
    <main>
      <section className="row" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
        <h1>Your Cart</h1>
        <Link href="/products" className="btn btn-ghost">
          Continue shopping
        </Link>
      </section>

      {items.length === 0 ? (
        <article className="card" style={{ padding: "1.2rem" }}>
          <h2>Cart is empty</h2>
          <p style={{ color: "#617065", marginTop: 8 }}>Add products from the catalog to start checkout.</p>
          <Link href="/products" className="btn btn-primary" style={{ marginTop: 12 }}>
            Browse products
          </Link>
        </article>
      ) : (
        <section className="grid" style={{ gridTemplateColumns: "1.5fr 1fr", alignItems: "start" }}>
          <article className="card" style={{ padding: "1rem" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={`${item.productId}-${item.variantId || "base"}`}>
                    <td>
                      <div className="row" style={{ alignItems: "center" }}>
                        <Image
                          src={optimizeImageUrl(
                            item.imageUrl || "https://images.unsplash.com/photo-1512436991641-6745cdb1723f",
                            180
                          )}
                          alt={item.name}
                          width={56}
                          height={56}
                          style={{ borderRadius: "0.5rem", objectFit: "cover" }}
                          unoptimized
                        />
                        <div>
                          <strong>{item.name}</strong>
                          <p style={{ color: "#617065", fontSize: 13 }}>{item.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        max={item.stockQuantity || 999}
                        value={item.quantity}
                        onChange={(event) => updateQty(index, Number(event.target.value))}
                        style={{ width: 70 }}
                      />
                    </td>
                    <td>{currency(item.priceCents)}</td>
                    <td>{currency(item.priceCents * item.quantity)}</td>
                    <td>
                      <button className="remove-link" onClick={() => removeItem(index)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article className="card stack summary-card" style={{ padding: "1rem" }}>
            <h2>Summary</h2>

            <div className="stack" style={{ gap: "0.35rem" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span>Subtotal</span>
                <strong>{currency(subtotalCents)}</strong>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span>Discount</span>
                <strong>-{currency(discountCents)}</strong>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span>Estimated shipping</span>
                <strong>{currency(estimatedShippingCents)}</strong>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span>Tax</span>
                <strong>{currency(taxCents)}</strong>
              </div>
              <hr style={{ width: "100%", border: "none", borderTop: "1px solid #dce1d5" }} />
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span>Total</span>
                <strong>{currency(totalCents)}</strong>
              </div>
            </div>

            <div className="stack">
              <label className="stack" style={{ gap: 6 }}>
                Coupon code
                <input
                  value={couponInput}
                  onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
                  placeholder="WELCOME10"
                />
              </label>
              <button type="button" className="btn btn-secondary" onClick={applyCoupon}>
                Apply coupon
              </button>
              {message ? <span style={{ color: "#617065" }}>{message}</span> : null}
            </div>

            <Link
              className="btn btn-primary checkout-cta"
              href={`/checkout${coupon ? `?coupon=${encodeURIComponent(coupon.code)}` : ""}`}
            >
              Proceed to checkout
            </Link>

            <div className="security-row">
              <span className="security-pill">SSL Secure</span>
              <span className="security-pill">Fast Delivery</span>
              <span className="security-pill">Easy Returns</span>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
