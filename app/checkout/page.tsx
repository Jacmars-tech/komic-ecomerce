"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ShoppingBag, ChevronRight, Lock, CreditCard, Smartphone, CheckCircle2 } from "lucide-react";

import { clearCart, readCart, writeCart } from "@/lib/cart-storage";
import { PaymentSimulation } from "@/components/PaymentSimulation";

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

type CheckoutState = {
  guestEmail: string;
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  paymentMethod: "CARD" | "MPESA" | "BANK_TRANSFER" | "CASH_ON_DELIVERY";
  couponCode: string;
};

const initialState: CheckoutState = {
  guestEmail: "",
  name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "Nairobi",
  state: "Nairobi",
  postalCode: "00100",
  country: "Kenya",
  paymentMethod: "MPESA",
  couponCode: ""
};

function money(cents: number) {
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

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [form, setForm] = useState<CheckoutState>(initialState);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  useEffect(() => {
    const coupon = searchParams.get("coupon") || "";
    setForm((prev) => ({ ...prev, couponCode: coupon }));

    const syncCart = async () => {
      const initialCart = readCart() as CartItem[];
      const reconciled = await reconcileCart(initialCart);
      setCart(reconciled.items);
      if (reconciled.removed > 0) {
        writeCart(reconciled.items as any);
        setStatus("Some unavailable items were removed from your cart.");
      }
    };

    syncCart();
  }, [searchParams]);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.priceCents * item.quantity, 0), [cart]);
  const shipping = subtotal > 0 ? 50000 : 0;
  const tax = Math.round(subtotal * Number(process.env.NEXT_PUBLIC_TAX_RATE || 0.16));
  const total = subtotal + shipping + tax;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (cart.length === 0) {
      setStatus("Your cart is empty.");
      return;
    }

    setLoading(true);
    setStatus(null);

    const reconciled = await reconcileCart(cart);
    if (reconciled.removed > 0) {
      writeCart(reconciled.items as any);
      setCart(reconciled.items);
      setStatus("Some unavailable items were removed. Review your cart and try again.");
    }
    if (reconciled.items.length === 0) {
      setLoading(false);
      return;
    }

    const idempotencyKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const payload = {
      items: reconciled.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: item.quantity
      })),
      shipping: {
        name: form.name,
        phone: form.phone,
        line1: form.line1,
        line2: form.line2,
        city: form.city,
        state: form.state,
        postalCode: form.postalCode,
        country: form.country
      },
      paymentMethod: form.paymentMethod,
      couponCode: form.couponCode,
      idempotencyKey,
      guestEmail: form.guestEmail
    };

    try {
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const orderData = await orderRes.json().catch(() => ({}));

      if (!orderRes.ok) {
        setLoading(false);
        if (orderData?.error?.includes("One or more products were not found")) {
          const retryCart = await reconcileCart(readCart() as CartItem[]);
          writeCart(retryCart.items as any);
          setCart(retryCart.items);
          setStatus("Some products are no longer available. Cart has been refreshed.");
          return;
        }
        setStatus(orderData.error || "Checkout failed");
        return;
      }

      setPlacedOrderId(orderData.order.id);

      if (form.paymentMethod !== "CASH_ON_DELIVERY") {
        setShowPayment(true);
        setLoading(false);
      } else {
        completeOrder(orderData.order.id);
      }
    } catch (err) {
      setLoading(false);
      setStatus("A connection error occurred.");
    }
  };

  const onPaymentSuccess = async (method: "CARD" | "MPESA") => {
    if (!placedOrderId) return;

    setLoading(true);
    setStatus("Payment confirmed. Finalizing your order...");

    const intentRes = await fetch("/api/payments/create-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: placedOrderId,
        guestEmail: form.guestEmail || undefined
      })
    });
    const intentPayload = await intentRes.json().catch(() => ({}));
    if (!intentRes.ok) {
      setLoading(false);
      setStatus(intentPayload.error || "Failed to create payment intent.");
      return;
    }

    const webhookRes = await fetch("/api/payments/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "payment.succeeded",
        orderId: placedOrderId,
        providerRef: intentPayload.providerRef,
        payload: {
          simulated: true,
          method,
          channel: method === "MPESA" ? "daraja_mock" : "card_mock"
        }
      })
    });
    if (!webhookRes.ok) {
      const webhookPayload = await webhookRes.json().catch(() => ({}));
      setLoading(false);
      setStatus(webhookPayload.error || "Payment confirmation failed.");
      return;
    }

    completeOrder(placedOrderId);
  };

  const completeOrder = (orderId: string) => {
    clearCart();
    setLoading(false);
    setStatus(`Success! Your order #${orderId} has been placed.`);

    setTimeout(() => {
      router.push("/account");
      router.refresh();
    }, 1500);
  };

  if (cart.length === 0 && !status?.includes("Success")) {
    return (
      <main className="container section">
        <div className="card glass text-center animate-fade-in" style={{ padding: '4rem 2rem' }}>
          <ShoppingBag size={64} className="text-muted mb-4" style={{ margin: '0 auto' }} />
          <h2>Your cart is empty</h2>
          <p className="text-muted mb-8">Add some premium items to your collection before checking out.</p>
          <Link href="/products" className="btn btn-primary">
            Start Shopping
          </Link>
        </div>
      </main>
    );
  }

  if (showPayment && placedOrderId) {
    return (
      <main className="container section">
        <div className="hero-content text-center mb-8">
          <h1>Complete Your Payment</h1>
          <p className="text-muted">Order #{placedOrderId} is ready for processing.</p>
        </div>
        <PaymentSimulation
          amount={total}
          method={form.paymentMethod === "CARD" ? "CARD" : "MPESA"}
          onSuccess={onPaymentSuccess}
        />
        {status && <p className="text-center mt-4 text-success font-semibold">{status}</p>}
      </main>
    );
  }

  return (
    <main className="container section">
      <div className="flex items-center gap-2 text-muted mb-8" style={{ fontSize: '0.9rem' }}>
        <Link href="/cart">Cart</Link>
        <ChevronRight size={14} />
        <span className="text-primary font-semibold">Checkout</span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', gap: '3rem', alignItems: 'start' }}>
        <section className="stack">
          <div className="hero-content" style={{ textAlign: 'left', padding: 0 }}>
            <h1 style={{ fontSize: '2.5rem' }}>Shipping Details</h1>
            <p className="text-muted">Please provide your delivery information below.</p>
          </div>

          <form id="checkout-form" className="card glass stack mt-4" style={{ padding: '2rem' }} onSubmit={onSubmit}>
            <div className="stack gap-4">
              <div className="stack">
                <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Email Address</label>
                <input
                  type="email"
                  required
                  className="input"
                  value={form.guestEmail}
                  onChange={(e) => setForm(prev => ({ ...prev, guestEmail: e.target.value }))}
                  placeholder="you@example.com"
                />
              </div>

              <div className="form-grid">
                <div className="stack">
                  <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Full Name</label>
                  <input required className="input" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} />
                </div>
                <div className="stack">
                  <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Phone Number</label>
                  <input required className="input" value={form.phone} onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))} placeholder="0712 345 678" />
                </div>
              </div>

              <div className="stack">
                <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Shipping Address</label>
                <input required className="input" value={form.line1} onChange={e => setForm(prev => ({ ...prev, line1: e.target.value }))} placeholder="Street address, Apartment, etc." />
              </div>

              <div className="form-grid">
                <div className="stack">
                  <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>City</label>
                  <input required className="input" value={form.city} onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))} />
                </div>
                <div className="stack">
                  <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>County / State</label>
                  <input required className="input" value={form.state} onChange={e => setForm(prev => ({ ...prev, state: e.target.value }))} />
                </div>
              </div>

              <div className="stack pt-4 border-t">
                <label style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>Payment Method</label>
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, paymentMethod: 'MPESA' }))}
                    className={`btn ${form.paymentMethod === 'MPESA' ? 'btn-primary' : 'btn-outline'} gap-2`}
                  >
                    <Smartphone size={18} />
                    M-Pesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, paymentMethod: 'CARD' }))}
                    className={`btn ${form.paymentMethod === 'CARD' ? 'btn-primary' : 'btn-outline'} gap-2`}
                  >
                    <CreditCard size={18} />
                    Card
                  </button>
                </div>
              </div>
            </div>
          </form>

          <div className="flex items-center gap-4 mt-8 text-success font-semibold glass p-4 rounded-lg border">
            <Lock size={20} />
            Your data is encrypted and secure.
          </div>
        </section>

        <aside className="stack" style={{ position: 'sticky', top: '100px' }}>
          <div className="card glass stack" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>Order Summary</h2>

            <div className="stack gap-3 py-4">
              {cart.map((item) => (
                <div key={`${item.productId}-${item.variantId || "base"}`} className="flex justify-between items-center text-sm">
                  <span className="flex-1">
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-muted ml-2">x {item.quantity}</span>
                  </span>
                  <span className="font-medium">{money(item.priceCents * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="stack gap-2 pt-4 border-t" style={{ fontSize: '0.95rem' }}>
              <div className="flex justify-between">
                <span className="text-muted">Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Shipping</span>
                <span>{money(shipping)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Tax (16%)</span>
                <span>{money(tax)}</span>
              </div>
              <div className="flex justify-between pt-4 mt-2 border-t" style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                <span>Total</span>
                <span className="text-accent">{money(total)}</span>
              </div>
            </div>

            <button
              form="checkout-form"
              type="submit"
              className="btn btn-primary mt-8"
              style={{ width: '100%', padding: '1.25rem' }}
              disabled={loading}
            >
              {loading ? "Processing..." : "Continue to Payment"}
            </button>

            {status ? (
              <p
                className={
                  status.toLowerCase().includes("success") || status.toLowerCase().includes("confirmed")
                    ? "text-center mt-4 text-success text-sm font-medium"
                    : "text-center mt-4 text-error text-sm font-medium"
                }
              >
                {status}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 mt-4 px-4">
            <div className="flex items-center gap-2 text-muted text-xs">
              <CheckCircle2 size={12} className="text-success" />
              Verified by VISA & MasterPass
            </div>
            <div className="flex items-center gap-2 text-muted text-xs">
              <CheckCircle2 size={12} className="text-success" />
              SAFARICOM Authorized Daraja API
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
