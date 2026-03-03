"use client";

import { FormEvent, useState } from "react";

type SellState = {
  name: string;
  description: string;
  brand: string;
  sku: string;
  price: string;
  discount: string;
  stock: string;
  categorySlug: string;
  imageUrl: string;
};

const initialState: SellState = {
  name: "",
  description: "",
  brand: "",
  sku: "",
  price: "",
  discount: "",
  stock: "",
  categorySlug: "general",
  imageUrl: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f"
};

export function SellForm() {
  const [form, setForm] = useState<SellState>(initialState);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setStatus(null);

    const price = Number(form.price);
    const stock = Number(form.stock);
    const discount = form.discount ? Number(form.discount) : null;

    if (!Number.isFinite(price) || price <= 0) {
      setSaving(false);
      setStatus("Enter a valid product price.");
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setSaving(false);
      setStatus("Enter a valid stock quantity.");
      return;
    }

    if (discount !== null && (!Number.isFinite(discount) || discount < 0)) {
      setSaving(false);
      setStatus("Enter a valid discount value.");
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          brand: form.brand,
          sku: form.sku,
          priceCents: Math.round(price * 100),
          discountPriceCents: discount !== null ? Math.round(discount * 100) : null,
          stockQuantity: stock,
          categorySlug: form.categorySlug,
          imageUrls: [form.imageUrl]
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(payload.error || "Unable to publish product");
        return;
      }

      setForm(initialState);
      setStatus("Product published. You can now manage it from the admin dashboard.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("Publish request timed out. Please try again.");
      } else {
        setStatus("Network error while publishing. Please retry.");
      }
    } finally {
      clearTimeout(timeout);
      setSaving(false);
    }
  };

  return (
    <section className="card stack" style={{ padding: "1.2rem" }}>
      <h2>Sell your product</h2>
      <p className="text-muted">List your product in minutes. Your account will be seller-enabled automatically.</p>

      <form className="stack" onSubmit={submit}>
        <div className="form-grid">
          <label className="stack" style={{ gap: "0.35rem" }}>
            Product name
            <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
          </label>
          <label className="stack" style={{ gap: "0.35rem" }}>
            Brand
            <input value={form.brand} onChange={(e) => setForm((prev) => ({ ...prev, brand: e.target.value }))} required />
          </label>
          <label className="stack" style={{ gap: "0.35rem" }}>
            SKU
            <input value={form.sku} onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))} required />
          </label>
          <label className="stack" style={{ gap: "0.35rem" }}>
            Category slug
            <input
              value={form.categorySlug}
              onChange={(e) => setForm((prev) => ({ ...prev, categorySlug: e.target.value }))}
              required
            />
          </label>
          <label className="stack" style={{ gap: "0.35rem" }}>
            Price (KES)
            <input
              type="number"
              min={1}
              value={form.price}
              onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
              required
            />
          </label>
          <label className="stack" style={{ gap: "0.35rem" }}>
            Discount (KES)
            <input
              type="number"
              min={0}
              value={form.discount}
              onChange={(e) => setForm((prev) => ({ ...prev, discount: e.target.value }))}
            />
          </label>
          <label className="stack" style={{ gap: "0.35rem" }}>
            Stock quantity
            <input
              type="number"
              min={0}
              value={form.stock}
              onChange={(e) => setForm((prev) => ({ ...prev, stock: e.target.value }))}
              required
            />
          </label>
          <label className="stack" style={{ gap: "0.35rem" }}>
            Image URL
            <input
              value={form.imageUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
              required
            />
          </label>
          <label className="stack full" style={{ gap: "0.35rem" }}>
            Description
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              required
            />
          </label>
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Publishing..." : "Publish product"}
        </button>
      </form>

      {status ? <p style={{ color: "#425f55" }}>{status}</p> : null}
    </section>
  );
}
