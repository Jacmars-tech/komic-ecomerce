"use client";

import { useState } from "react";

import { readCart, writeCart } from "@/lib/cart-storage";

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
  variantId?: string | null;
};

export function AddToCartButton({ product, variantId }: Props) {
  const [label, setLabel] = useState("Add to cart");

  const onAdd = () => {
    try {
      const cart = readCart();
      const index = cart.findIndex(
        (item) => item.productId === product.id && (item.variantId || null) === (variantId || null)
      );

      if (index >= 0) {
        const nextQty = Math.min(product.stockQuantity, cart[index].quantity + 1);
        cart[index].quantity = nextQty;
      } else {
        cart.push({
          productId: product.id,
          variantId: variantId || null,
          name: product.name,
          sku: product.sku,
          priceCents: product.discountPriceCents ?? product.priceCents,
          quantity: 1,
          stockQuantity: product.stockQuantity,
          imageUrl: product.imageUrl
        });
      }

      const saveResult = writeCart(cart);
      if (!saveResult.ok) {
        setLabel("Storage full");
        setTimeout(() => setLabel("Add to cart"), 1600);
        return;
      }
      if (saveResult.persistence === "memory") {
        setLabel("Added (temp)");
        setTimeout(() => setLabel("Add to cart"), 1400);
        return;
      }
    } catch {
      setLabel("Try again");
      setTimeout(() => setLabel("Add to cart"), 1200);
      return;
    }

    setLabel("Added");
    setTimeout(() => setLabel("Add to cart"), 1200);
  };

  return (
    <button
      className="btn btn-primary"
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onAdd();
      }}
      disabled={product.stockQuantity <= 0}
    >
      {product.stockQuantity <= 0 ? "Out of stock" : label}
    </button>
  );
}
