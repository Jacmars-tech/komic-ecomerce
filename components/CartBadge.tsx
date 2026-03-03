"use client";

import { useEffect, useState } from "react";

import { readCart } from "@/lib/cart-storage";

function readCount(): number {
  if (typeof window === "undefined") {
    return 0;
  }

  return readCart().reduce((total, item) => total + item.quantity, 0);
}

export function CartBadge() {
  const [count, setCount] = useState(0);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    const refresh = async () => {
      const nextCount = readCount();

      // Best-effort server sync for signed-in users.
      try {
        const response = await fetch("/api/cart", { cache: "no-store" });
        if (response.ok) {
          const payload = await response.json().catch(() => ({}));
          const serverItems = Array.isArray(payload?.items) ? payload.items : [];
          const serverCount = serverItems.reduce(
            (total: number, item: { quantity?: number }) => total + Number(item.quantity || 0),
            0
          );
          if (Number.isFinite(serverCount)) {
            // Keep whichever source has the latest higher count.
            setCount((prev) => {
              const merged = Math.max(nextCount, serverCount);
              if (prev !== merged) {
                setBump(true);
                setTimeout(() => setBump(false), 220);
              }
              return merged;
            });
            return;
          }
        }
      } catch {
        // Ignore server failures and fall back to local cart.
      }

      setCount((prev) => {
        if (prev !== nextCount) {
          setBump(true);
          setTimeout(() => setBump(false), 220);
        }
        return nextCount;
      });
    };

    void refresh();

    window.addEventListener("storage", refresh);
    window.addEventListener("cart:updated", refresh as EventListener);
    window.addEventListener("focus", refresh);
    window.addEventListener("popstate", refresh);

    // Fallback polling to recover from missed browser events.
    const interval = setInterval(() => void refresh(), 3000);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("cart:updated", refresh as EventListener);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("popstate", refresh);
      clearInterval(interval);
    };
  }, []);

  return (
    <span className={`badge ${bump ? "cart-bump" : ""}`} aria-label="Cart item count">
      Cart <span className="nav-link-count">({count})</span>
    </span>
  );
}
