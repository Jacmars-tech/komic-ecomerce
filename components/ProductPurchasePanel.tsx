"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { readCart, writeCart } from "@/lib/cart-storage";

type Variant = {
  id: string;
  name: string;
  value: string;
  stockQuantity: number;
  priceDeltaCents: number;
};

type Props = {
  product: {
    id: string;
    name: string;
    sku: string;
    priceCents: number;
    discountPriceCents: number | null;
    stockQuantity: number;
    imageUrl?: string;
  };
  variants: Variant[];
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: process.env.NEXT_PUBLIC_CURRENCY || "KES"
  }).format(cents / 100);
}

export function ProductPurchasePanel({ product, variants }: Props) {
  const router = useRouter();
  const [selectedVariantId, setSelectedVariantId] = useState<string>(variants[0]?.id || "");
  const [label, setLabel] = useState("Add to cart");

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) || null,
    [variants, selectedVariantId]
  );

  const basePrice = product.discountPriceCents ?? product.priceCents;
  const currentPrice = basePrice + (selectedVariant?.priceDeltaCents || 0);
  const availableStock = selectedVariant?.stockQuantity ?? product.stockQuantity;

  const upsertCart = (): boolean => {
    const cart = readCart();
    const variantId = selectedVariant?.id || null;
    const itemSku = selectedVariant ? `${product.sku}-${selectedVariant.value}` : product.sku;

    const index = cart.findIndex(
      (item) => item.productId === product.id && (item.variantId || null) === variantId
    );

    if (index >= 0) {
      cart[index].quantity = Math.min(cart[index].quantity + 1, availableStock);
      cart[index].priceCents = currentPrice;
      cart[index].stockQuantity = availableStock;
      return writeCart(cart).ok;
    }

    cart.push({
      productId: product.id,
      variantId,
      name: product.name,
      sku: itemSku,
      priceCents: currentPrice,
      quantity: 1,
      stockQuantity: availableStock,
      imageUrl: product.imageUrl
    });

    return writeCart(cart).ok;
  };

  const addToCart = () => {
    if (!upsertCart()) {
      setLabel("Storage full");
      setTimeout(() => setLabel("Add to cart"), 1500);
      return;
    }
    setLabel("Added");
    setTimeout(() => setLabel("Add to cart"), 1200);
  };

  const buyNow = () => {
    if (!upsertCart()) {
      setLabel("Storage full");
      setTimeout(() => setLabel("Add to cart"), 1500);
      return;
    }
    router.push("/checkout");
  };

  return (
    <div className="stack" style={{ gap: "0.62rem" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong style={{ fontSize: "1.55rem" }}>{formatCurrency(currentPrice)}</strong>
        {product.discountPriceCents ? (
          <span style={{ textDecoration: "line-through", color: "#6f7892" }}>
            {formatCurrency(product.priceCents)}
          </span>
        ) : null}
      </div>

      <p style={{ color: "#4f5f80" }}>
        {availableStock > 0 ? `Only ${availableStock} left in stock.` : "Out of stock"}
      </p>
      <p style={{ color: "#4f5f80" }}>245 people bought this in the last 7 days.</p>

      {variants.length > 0 ? (
        <label className="stack" style={{ gap: "0.35rem" }}>
          Choose variant
          <select
            value={selectedVariantId}
            onChange={(event) => setSelectedVariantId(event.target.value)}
            aria-label="Select product variant"
          >
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.name}: {variant.value}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="row">
        <button className="btn btn-primary" type="button" onClick={addToCart} disabled={availableStock <= 0}>
          {label}
        </button>
        <button className="btn btn-secondary" type="button" onClick={buyNow} disabled={availableStock <= 0}>
          Buy now
        </button>
      </div>

      <div className="security-row">
        <span className="security-pill">SSL Secure</span>
        <span className="security-pill">Verified Payments</span>
        <span className="security-pill">Refund Guarantee</span>
      </div>

      <div className="mobile-buy-bar">
        <button className="btn btn-primary" type="button" onClick={addToCart} disabled={availableStock <= 0}>
          Add to cart
        </button>
        <button className="btn btn-secondary" type="button" onClick={buyNow} disabled={availableStock <= 0}>
          Buy now
        </button>
      </div>
    </div>
  );
}
